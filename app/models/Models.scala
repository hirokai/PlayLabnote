package models

import play.api.libs.json.{Json, JsValue, Writes}
import anorm._
import play.api.db.DB
import play.api.Play.current
import play.api.Logger
import java.sql.Connection
import javax.transaction.Transaction
import scala.reflect.ClassTag

object Database {
  type Id = Long
  def escape(s: String) = s.replace("'","''")
}

import Database.Id
import Database.escape

case class Experiment (
                       id: Id,
                       owner: Id,
                       name: String,
                       protocolSamples: Array[ProtocolSample] = Array(),
                       runs: Array[ExpRun] = Array(),
                       note: String = "",
                       runSamples: Map[(Id,Id),Sample] = Map()
                       )

object Experiment {
  def fromRow(row: Row) = {
    Experiment(
      id = row[Id]("id"),
      name = row[Option[String]]("name").getOrElse("(N/A)"),
      owner = row[Id]("owner")
    )
  }
}

case class ExperimentAccess(owner: Id = 0) {
  def create(name: String, owner: Option[Id] = None)(implicit c: Connection): Option[Id] = {
      val oid: Id = owner.getOrElse(0l) // default is sandbox user.
      SQL(s"INSERT into Experiment(owner,name) values($oid,'${escape(name)}')").executeInsert()
  }

  def setName(id: Id, name: String, owner: Option[Id] = None)(implicit c: Connection): Boolean = {
        val oid: Id = owner.getOrElse(0l) // default is sandbox user.
    if(name.trim == ""){
      false
    }else{
      1 == SQL(s"UPDATE Experiment SET name='${escape(name)}' where owner=$oid and id=$id").executeUpdate()
    }
  }

  def countTotal(implicit c: Connection): Long = {
    SQL(s"SELECT count(*) as c from Experiment where owner=$owner")().map(_[Long]("c")).headOption.getOrElse(0l)
  }

  def delete(id: Id, owner: Option[Id] = None)(implicit c: Connection): Boolean = {
      val oid: Id = owner.getOrElse(0l) // default is sandbox user.
      val ridstr = SQL(s"SELECT id from ExpRun where experiment=$id")().map(_[Id]("id")).mkString(",")
      SQL(s"DELETE from SampleInRun where run in($ridstr)").executeUpdate()
      SQL(s"DELETE from ProtocolSample where experiment=$id").executeUpdate()
      SQL(s"DELETE from ProtocolStep where experiment=$id").executeUpdate()
      SQL(s"DELETE from ExpRun where experiment=$id").executeUpdate()
      1 == SQL("DELETE from Experiment where owner={o} and id={id}").on('o -> oid, 'id -> id).executeUpdate()
  }

  def getFull(id: Id)(implicit c: Connection): Option[Experiment] = {
    val e: Option[Experiment] = get(id)
    e match {
      case Some(exp) =>{
        val runs: Array[ExpRun] = getRuns(id)
        val pss: Array[ProtocolSample] = getProtocolSamples(id)
        val rss: Map[(Id,Id),Sample] = getRunSamplesKeyValue(id)
        Some(exp.copy(runs = runs, protocolSamples = pss, runSamples = rss))
      }
      case _ =>
        None
    }
  }

  def get(id: Id,
          with_runs: Boolean = false,
          with_psamples: Boolean = false)(implicit c: Connection): Option[Experiment] = {
      val exp: Option[models.Experiment] =
        SQL("Select * from Experiment where id={id} limit 1").on('id -> id)()
          .map(Experiment.fromRow).headOption
      exp match {
        case Some(e) => {
          val runs: Array[ExpRun] = if (with_runs) getRuns(id) else Array()
          val psamples: Array[ProtocolSample] = if (with_psamples) getProtocolSamples(id) else Array()
          Some(e.copy(protocolSamples = psamples.toArray, runs = runs.toArray))
        }
        case _ => None
      }
  }

  def createRunSample(rid: Id, pid: Id, name: String, tid2: Option[Id])(implicit c: Connection): Option[Id] = {
      val o_tid = tid2 match {
        case None => ProtocolSampleAccess().sampleTypeId(pid)
        case Some(t) => Some(t)
      }
      o_tid.flatMap{tid =>
        val o_id: Option[Id] = SQL(s"INSERT into Sample(owner,name,type) values($owner,'${escape(name)}',$tid)").executeInsert()
        o_id.flatMap{ id =>
          SQL(s"INSERT into SampleInRun(sample,protocol_sample,run) values($id,$pid,$rid)").executeInsert()
        }
        o_id
      }
  }

  def deleteRunSample(rid: Id, pid: Id)(implicit c: Connection): Boolean = {
    0 < SQL(s"DELETE from SampleInRun where run=$rid and protocol_sample=$pid").executeUpdate()
  }

  def getRunSamplesKeyValue(eid: Id)(implicit c: Connection): Map[(Id,Id),Sample] = {
      val ids = SQL(s"SELECT id from ExpRun where experiment=$eid")().map(_[Id]("id"))
      val idsstr = ids.mkString(",")
      val ss: Stream[((Id,Id),Sample)] =
        SQL(s"SELECT * from SampleInRun where run in ($idsstr)")().map{row =>
          val sid = row[Id]("sample")
          val r = row[Id]("run")
          val p = row[Id]("protocol_sample")
          val s = SampleAccess(owner).get(sid).get
          ((r,p),s)
        }
      ss.toMap
  }

  def getRunSamples(eid: Id)(implicit c: Connection): Array[Sample] = {
    getRunSamplesKeyValue(eid).values.toArray
  }

  def addRun(eid: Id, name: String)(implicit c: Connection): Option[Id] = {
    ExpRunAccess().create(eid, name)
  }

  def getRuns(eid: Id)(implicit c: Connection): Array[ExpRun] = {
    SQL(s"SELECT * from ExpRun where experiment=$eid")().map(ExpRun.fromRow).toArray
  }

  def addProtocolSample(eid: Id, name: String, tid: Id)(implicit c: Connection): Option[Id] = {
    ProtocolSampleAccess().create(eid,name,tid)
  }

  def getProtocolSamples(eid: Id)(implicit c: Connection): Array[ProtocolSample] = {
    SQL(s"SELECT * from ProtocolSample where experiment=$eid")().map(ProtocolSample.fromRow).toArray
  }

  //@Transaction
  def deleteProtocolSample(pid: Id, force: Boolean = false)(implicit c: Connection): Either[String,String] = {
    if(force){
      SQL(s"DELETE * from SampleInRun where protocol_sample=$pid").executeUpdate()
      val r = SQL(s"DELETE * from ProtocolSample where id=$pid").executeUpdate()
      if(r == 1){
        Right("Done.")
      }else if(r ==0){
        Left("Not found.")
      }else{
        Left("Unknown error.")
      }
    }else{
      if(SQL(s"SELECT count(*) as c from SampleInRun where protocol_sample=$pid")().map(_[Long]("c")).headOption == Some(0l)){
        val r = SQL(s"DELETE from ProtocolSample where id=$pid").executeUpdate()
        if(r == 1){
          Right("Done")
        }else if(r == 0){
          Left("Not found.")
        }else{
          Left("Unknown error.")
        }
      }else{
        Left("Run samples still exist.")
      }
    }
  }

  //Run samples
  def countRunSamples(rid: Id, pid: Id)(implicit c: Connection): Long = {
      SQL("SELECT COUNT(*) as c from SampleInRun where run={r} and protocol_sample={p}")
              .on('r -> rid, 'p -> pid)().map(_[Long]("c")).head
  }

  def assignExistingSample(pid: Id, rid: Id, sid: Id)(implicit c: Connection): Option[Id] = {
      val count: Long = countRunSamples(rid,pid)
      if(count == 0){
        SQL("INSERT into SampleInRun(sample,protocol_sample,run) values({s},{p},{r})")
            .on('s -> sid, 'p -> pid, 'r -> rid).executeInsert()
      }else{
        None
      }
  }

  //Only allows one runsample per (rid,pid) point.
  def assignNewSample(rid: Id, pid: Id, sname: String, typ: Id)(implicit c: Connection): Option[Id] = {
      val o_sid = SampleAccess(owner).create(sname,typ)
      o_sid.flatMap { sid =>
          val count = countRunSamples(rid,pid)
          if(count == 0){
            SQL(s"INSERT into SampleInRun(sample,protocol_sample,run) values($sid,$pid,$rid)")
             .executeInsert()
          }else{
            None
          }
      }
  }

  def removeSampleAssignment(pid: Id, rid: Id)(implicit c: Connection): Boolean = {
        0 < SQL("DELETE from SampleInRun where run={r} and protocol_sample={p}")
          .on('r -> rid, 'p -> pid).executeUpdate()
  }
}

case class ProtocolSample(id: Id, name: String, note: String = "", typ: SampleType = SampleType.AnyType)

object ProtocolSample {
  def fromRow(row: Row)(implicit c: Connection): ProtocolSample = {
    val tid = row[Id]("type")
    val t = SampleTypeAccess().get(tid).get
    ProtocolSample(
      row[Id]("id"),
      row[String]("name"),
      row[Option[String]]("note").getOrElse(""),
      t
    )
  }
}

case class ProtocolSampleAccess() {
  val dbname = "ProtocolSample"

  def create(eid: Id, name: String, tid: Id)(implicit c: Connection): Option[Id] = {
     SQL(s"INSERT into ProtocolSample(name,experiment,type) values('${escape(name)}',$eid,$tid)").executeInsert()
  }

  def setName(id: Id, name: String, owner: Option[Id] = None)(implicit c: Connection): Boolean = {
        1 == SQL(s"UPDATE ProtocolSample SET name='${escape(name)}' where id=$id").executeUpdate()
  }

  def listInExp(eid: Id)(implicit c: Connection): Stream[ProtocolSample] = {
      SQL(s"SELECT * from ProtocolSample where experiment=$eid")().map(ProtocolSample.fromRow)
  }

  def get(psid: Id)(implicit c: Connection): Option[ProtocolSample] = {
    SQL(s"SELECT type from ProtocolSample where id=$psid")().map(ProtocolSample.fromRow).headOption
  }

  def sampleTypeId(psid: Id)(implicit c: Connection): Option[Id] = {
    SQL(s"SELECT type from ProtocolSample where id=$psid")().map(_[Id]("type")).headOption
  }
  def sampleType(psid: Id)(implicit c: Connection): Option[SampleType] = {
    SQL(s"SELECT type from ProtocolSample where id=$psid")().map(_[Id]("type")).headOption.flatMap{ t =>
      SampleTypeAccess().get(t)
    }
  }
}

case class SampleType(id: Id, name: String, parent: Option[Id])

object SampleType {
  val AnyType = SampleType(0, "Any", None)
  def fromRow(row: Row): SampleType = {
    SampleType(row[Id]("id"), row[String]("name"), row[Option[Id]]("parent"))
  }
}

case class Tree[A: ClassTag](node:A, children: Array[Tree[A]]) {
  def flatten: Array[A] = {
    val n: Array[A] = Array(node)
    val cs: Array[A] = children.map(_.flatten).flatten
    n ++ cs
  }
}

case class SampleTypeAccess(owner: Id = 0) {
  val dbname = "SampleType"

  def create(name: String, parent: Id, system: Boolean = false)(implicit c: Connection): Option[Id] = {
    val exists = 0 < SQL(s"SELECT count(*) as c from SampleType where exists" +
       s" (SELECT * from SampleType where owner=$owner and name='${escape(name)}')")().map(_[Long]("c")).head
    if(!exists) {
      SQL(s"INSERT into SampleType(owner,name,parent,system) values($owner,'${escape(name)}',$parent,$system)").executeInsert()
    }else{
      None
    }
  }

  def update(id: Id, o_name: Option[String], o_parent: Option[Id])(implicit c: Connection): Either[String,String] = {
    if(o_name.isEmpty && o_parent.isEmpty){
      Left("No parameter.")
    }else if(o_name.map(_.trim) == Some("")){
      Left("Empty name.")
    }else{
      val str = (o_name,o_parent) match {
        case (Some(name),Some(parent)) => "name='%s',parent=%d".format(name,parent)
        case (Some(name),None) => "name='%s'".format(name)
        case (None,Some(parent)) => "parent=%d".format(parent)
        case _ => throw new Exception("This should not happen.")
      }
      val cmd = s"UPDATE SampleType SET $str where id=$id"
      if(1 == SQL(cmd).executeUpdate()){
        Right("Done.")
      }else{
        Left("DB update failed: "+cmd)
      }
    }
  }

  def delete(id: Id, subtypes: Boolean = true)(implicit c: Connection): Boolean = {
    if(!hasSamples(id,subtypes)){
      val tids = if(subtypes) findDescendantsId()(id) else Array(id)
      val str = tids.mkString(",")
      0 < SQL(s"DELETE from SampleType where id in($str)").executeUpdate()
    }else if(isSystemType(id)){
      false
    }else{
      false
    }
  }

  def isSystemType(id: Id)(implicit c: Connection): Boolean = {
    SQL(s"SELECT system from SampleTypes where id=$id limit 1")().map(_[Boolean]("system")).headOption == Some(true)
  }

  def hasSamples(id: Id,subtypes: Boolean = true)(implicit c: Connection): Boolean = {
    val tids = if(subtypes) findDescendantsId()(id) else Array(id)
    val str = tids.mkString(",")
    0 < SQL(s"SELECT count(*) as c from Sample where exists" +
      s" (SELECT * from Sample where type in($str))")().map(_[Long]("c")).head
  }

  def getOrCreate(name: String, parent: Id)(implicit c: Connection): Option[Id] = {
    val o_st = SQL(s"SELECT * from SampleType where owner=$owner and name='${escape(name)}'")()
      .map(SampleType.fromRow).headOption
    o_st match {
      case None => {
        create(name,parent)
      }
      case Some(st) => {
        //Only for identical case, return that id.
        if(st.name == name && st.parent == Some(parent)){
          Some(st.id)
        }else{
          None
        }
      }
    }
  }

  def get(id: Id)(implicit c: Connection): Option[SampleType] = {
       SQL(s"SELECT * from SampleType where owner=$owner and id='$id'")().map(SampleType.fromRow).headOption
  }

  def getTypeIdTree(depth: Int = 20)(root: Id)(implicit c: Connection): Tree[Id] = {
    val cs = if(depth == 0) Array() else findChildrenId(root)
    Tree(root,cs.map(getTypeIdTree(depth-1)))
  }

  def getTypeTree(depth: Int = 20)(root: SampleType)(implicit c: Connection): Tree[SampleType] = {
    val cs = if(depth == 0) Array() else findChildren(root)
    Tree(root,cs.map(getTypeTree(depth-1)))
  }

  //Includes itself
  def findDescendantsId(depth: Int = 20)(tid: Id)(implicit c: Connection): Array[Id] = {
    getTypeIdTree(depth)(tid).flatten
  }

  //Includes itself
  def findDescendants(depth: Int = 20)(t: SampleType)(implicit c: Connection): Array[SampleType] = {
    getTypeTree(depth)(t).flatten
  }

//  def findDescendantsId(depth: Int = 20)(tid: Id)(implicit c: Connection): Array[Id] = {
//    if(depth == 0){
//      Array()
//    }else{
//      val cs: Array[Id] = findChildrenId(tid)
//      val cs2: Array[Id] = cs.map(findDescendantsId(depth-1)).flatten
//      cs ++ cs2
//    }
//  }

  def findChildrenId(tid: Id)(implicit c: Connection): Array[Id] = {
      SQL(s"SELECT id from SampleType where owner=$owner and parent=$tid")().map(_[Id]("id")).toArray
  }
//
//  def findDescendants(depth: Int = 20)(t: SampleType)(implicit c: Connection): Array[SampleType] = {
//    if(depth == 0){
//      Array()
//    }else{
//      val cs: Array[SampleType] = findChildren(t)
//      val cs2: Array[SampleType] = cs.map(findDescendants(depth-1)).flatten
//      cs ++ cs2
//    }
//  }

  def findChildren(t: SampleType)(implicit c: Connection): Array[SampleType] = {
      SQL(s"SELECT * from SampleType where owner=$owner and parent=${t.id}")().map(SampleType.fromRow).toArray
  }

}



case class ExpRun(id: Id, name: String)

object ExpRun {
  def fromRow(row: Row): ExpRun = {
    ExpRun(
      name = row[Option[String]]("name").getOrElse("(N/A)"),
      id = row[Id]("id")
    )
  }
}

//ExpRun does not have owner property, because it has the same owner as parent Exp.
case class ExpRunAccess() {
  val dbname = "ExpRun"

  def create(eid: Id, name: String)(implicit c: Connection): Option[Id] = {
    SQL(s"INSERT into ExpRun(name,experiment) values('${escape(name)}',$eid)").executeInsert()
  }

  def setName(id: Id, name: String, owner: Option[Id] = None)(implicit c: Connection): Boolean = {
    if(name.trim == ""){
      false
    }else{
      1 == SQL(s"UPDATE Experiment SET name='${escape(name)}' where id=$id").executeUpdate()
    }
  }

  def delete(id: Id, owner: Option[Id] = None)(implicit c: Connection): Boolean = {
        1 == SQL(s"DELETE from Experiment where id=$id").executeUpdate()
  }

  def get(id: Id) = None

  //Return if exprun has not run sample or step info.
  def isEmpty(id: Id)(implicit c: Connection): Boolean = {
        val runSampleCount: Long
          = SQL(s"SELECT COUNT(*) as c from SampleInRun where run=$id")()
              .map(_[Long]("c")).head
        val runStepCount: Long
          = SQL(s"SELECT COUNT(*) as c from RunStep where owner={o} and run=$id")()
              .map(_[Long]("c")).head
        runSampleCount == 0 && runStepCount == 0
  }

  def deleteRun(id: Id, force: Boolean = false)(implicit c: Connection): Boolean = {
    if (isEmpty(id)) {
      delete(id)
    } else if (force) {
      SQL(s"DELETE from SampleInRun where run=$id").executeUpdate()
      SQL(s"DELETE from RunStep where run={id}").executeUpdate()
      delete(id)
    } else {
      false
    }
  }
}

case class SampleData(id: Id, name: String, url: String, note: String, typ: String)

case class Sample(id: Id, name: String, typ: Either[Id,SampleType] = Left(SampleType.AnyType.id), note: String = "", data: Array[SampleData] = Array())

object Sample {
  //Caution: Always use join query to include sampletype.
  def fromRow(row: Row): Sample = {
    val t = SampleType(id = row[Id]("sampletype.id"), name = row[String]("sampletype.name"), parent = row[Option[Id]]("sampletype.parent"))
    Sample(id = row[Id]("sample.id"), name=row[String]("sample.name"), typ = Right(t))
  }
}

case class SampleAccess(owner: Id = 0) {

  val dbname = "Sample"

  def get(id: Id)(implicit c: Connection): Option[Sample] = {
      SQL(s"SELECT * from Sample inner join sampletype on sample.type=sampletype.id " +
        s"where sample.owner=$owner and sample.id=$id")().map(Sample.fromRow).headOption
  }

  def list(implicit c: Connection): Array[Sample] = {
    SQL(s"SELECT * from sample inner join sampletype " +
      s"on sample.type = sampletype.id")().map(Sample.fromRow).toArray
  }

  def countTotal(implicit c: Connection): Long = {
    SQL(s"SELECT count(*) as c from Sample where owner=$owner")().map(_[Long]("c")).headOption.getOrElse(0l)
  }

  def create(name: String, tid: Id = SampleType.AnyType.id)(implicit c: Connection): Option[Id] = {
    if(name.trim == ""){
      None
    }else{
      SQL(s"INSERT into Sample(owner,name,type) values($owner,'${escape(name)}',$tid)").executeInsert()
    }
  }

  def delete(id: Id, force: Boolean = false)(implicit c: Connection): Boolean = {
    val exists = 0 < SQL(s"SELECT count(*) as c from SampleInRun where exists" +
      s" (SELECT * from SampleInRun where sample='$id')")().map(_[Long]("c")).head
    if(exists){
      if(force){
        SQL(s"DELETE from SampleInRun where sample=$id").executeUpdate()
        1 == SQL(s"DELETE from Sample where owner=$owner and id=$id").executeUpdate()
      }else{
        false
      }
    }else{
      1 == SQL(s"DELETE from Sample where owner=$owner and id=$id").executeUpdate()
    }
  }

  def setType(id: Id, tid: Id)(implicit c: Connection): Boolean = {
    1 == SQL(s"UPDATE Sample SET type=$tid where id=$id").executeUpdate()
  }

  def setName(id: Id, name: String)(implicit c: Connection): Boolean = {
    if(name.trim == ""){
      false
    }else{
      1 == SQL(s"UPDATE Sample SET name='${escape(name)}' where id=$id").executeUpdate()
    }
  }

  def update(id: Id, o_name: Option[String], o_type: Option[Id])(implicit c: Connection): Boolean = {
    if(o_name.isEmpty && o_type.isEmpty){
      false
    }else if(o_name.map(_.trim) == Some("")){
      false
    }else{
        val str = (o_name,o_type) match {
          case (Some(name),Some(typ)) => "name='%s',type=%d".format(name,typ)
          case (Some(name),None) => "name='%s'".format(name)
          case (None,Some(typ)) => "type=%d".format(typ)
          case _ => throw new Exception("This should not happen.")
        }
        1 == SQL(s"UPDATE Sample SET $str where id=$id").executeUpdate()
      }
    }

  def isTypeCompatibleWithAllAssignment(id: Id, tid: Id)(implicit c: Connection): Boolean = {
    true // stub
  }

  //samples of SampleType of tid (and subtypes).
  def findCompatibleSamples(tid: Id, subtypes: Boolean): Array[Sample] = {
    DB.withConnection {implicit c =>
      val str =
        if(subtypes)
          SampleTypeAccess(owner).findDescendantsId()(tid).mkString(",")
        else
          tid.toString
      SQL(s"SELECT * from sampletype inner join sample " +
        s"on sample.type = sampletype.id where sampletype.id in($str);")().map{row =>
        val tid = row[Id]("sampletype.id")
        val t = SampleType(tid,row[String]("sampletype.name"),row[Option[Id]]("parent"))
        Sample(name = row[String]("sample.name"), id=row[Id]("sample.id"), typ = Right(t))
      }.toArray
    }
  }

  //Count samples of SampleType of tid (and subtypes).
  def findCompatibleSampleCount(tid: Id, subtypes: Boolean): Long = {
    DB.withConnection {implicit c =>
      val str =
        if(subtypes)
          (SampleTypeAccess(owner).findDescendantsId()(tid) ++ Array(tid)).mkString(",")
        else
          tid.toString
      SQL(s"SELECT count(*) as c from sampletype inner join sample " +
        s"on sample.type = sampletype.id where sampletype.id in($str);")()
        .map(_[Long]("c")).headOption.getOrElse(0)
    }
  }
}

case class ProtocolStepParam(id: Id, name: String, typ: String, unit: String)
case class RunStepParam(id: Id, name: String, value: String, typ: String, unit: String)

case class StepParamAccess(owner: Id) {
  val dbname = "StepParam"
}

case class ProtocolStep(
           id: Id,
           name: String,
           input: Array[ProtocolSample],
           output: Array[ProtocolSample],
           params: Array[ProtocolStepParam])

class ProtocolStepAccess {
  val dbname = "ProtocolStep"

  def create(eid: Id, name: String,input: Array[Id],
             output: Array[Id], params: Array[ProtocolStepParam])(implicit c: Connection): Option[Id] = {
    if(name.trim == ""){
      None
    }else{
      val ps1: Option[Id] = SQL(s"INSERT into ProtocolStep(experiment,name) values($eid,'${escape(name)}')").executeInsert()
      for(p <- params){
        val pp: Option[Id] = SQL(
          "INSERT into ProtocolStepParam(step,name,ptype,unit) " +
            s"values($ps1,'$p.name','$p.typ','$p.unit')")
          .executeInsert()
      }
      ps1
    }
  }
}

case class RunStep(id: Id, run: Id, step: Id, value: String, typ: String, unit: String)

class RunStepAccess {
  def create(rid: Id, pid: Id, time_from: Option[Int], time_to: Option[Int],
             params: Array[RunStepParam] = Array())(implicit c: Connection): Option[Id] = {
      val tf_k: String = time_from.map(_ => ",time_from").getOrElse("")
      val tf_v: String = time_from.map(",%d".format(_)).getOrElse("")
      val tt_k: String = time_from.map(_ => ",time_to").getOrElse("")
      val tt_v: String = time_to.map(",%d".format(_)).getOrElse("")
      val ps1: Option[Id] = SQL(s"INSERT into RunStep(run,protocol_step$tf_k$tt_k) " +
        s"values($rid,$pid$tf_v$tt_v)").executeInsert()
      for(p <- params){
        val pp: Option[Id] = SQL(
          "INSERT into ProtocolStepParam(step,name,ptype,unit) " +
            s"values($ps1,'$p.name','$p.typ','$p.unit')")
          .executeInsert()
      }
      ps1
    }
}


object JsonWriter {
  implicit val implicitSampleTypeWrites = Json.writes[SampleType]
  def mkTreeJson(tree: Tree[SampleType]): JsValue = {
     Json.obj("node" -> tree.node, "children" -> Json.toJson(tree.children.map(mkTreeJson)))
  }
  def mkTreeIdJson(tree: Tree[Id]): JsValue = {
    Json.obj("node" -> tree.node, "children" -> Json.toJson(tree.children.map(mkTreeIdJson)))
  }
  implicit val implicitSampleTypeWrite2 = new Writes[Either[models.Database.Id,models.SampleType]] {
    def writes(e: Either[models.Database.Id,models.SampleType]): JsValue = {
      e match {
        case Left(id) => {
          Json.obj("id" -> id)
        }
        case Right(typ) => {
          Json.toJson(typ)
        }
      }
    }
  }

  implicit val implicitSampleDataWrites = Json.writes[SampleData]
  implicit val implicitSampleWrites = Json.writes[Sample]
  implicit val implicitProtocolSampleWrites = Json.writes[ProtocolSample]
  implicit val implicitProtocolStepParamWrites = Json.writes[ProtocolStepParam]
  implicit val implicitProtocolStepWrites = Json.writes[ProtocolStep]
  implicit val implicitRunStepParamWrites = Json.writes[RunStepParam]
  implicit val implicitRunStepWrites = Json.writes[RunStep]
  implicit val implicitExpRunWrites = Json.writes[ExpRun]


  implicit val implicitRunSamplesWrites = new Writes[Map[(Id,Id),Sample]] {
    def writes(m: Map[(Id,Id),Sample]): JsValue = {
      Json.toJson(for((k,v) <- m) yield {
        val kk = k._1.toString + ":" + k._2.toString
        (kk -> v)
      })
    }
  }

  implicit val implicitExperimentWrites = Json.writes[Experiment]
}

package models

import play.api.libs.json.{Json, JsValue, Writes}
import anorm._
import play.api.db.DB
import play.api.Play.current
import play.api.Logger
import java.sql.Connection
import javax.transaction.Transaction
import scala.reflect.ClassTag
import org.h2.jdbc.JdbcSQLException

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
                       protocolSteps: Array[ProtocolStep] = Array(),
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

  //@Transaction
  def delete(id: Id, owner: Option[Id] = None)(implicit c: Connection): Either[String,String] = {
    try{
      val oid: Id = owner.getOrElse(0l) // default is sandbox user.
      val ridstr = SQL(s"SELECT id from ExpRun where experiment=$id")().map(_[Id]("id")).mkString(",")
      SQL(s"DELETE from SampleInRun where run in($ridstr)").executeUpdate()
      val steps_str = SQL(s"SELECT id from ProtocolStep where experiment=$id")().map(_[Id]("id")).mkString(",")
      SQL(s"DELETE from ProtocolSampleInStep where step in($steps_str)").executeUpdate()
      SQL(s"DELETE from ProtocolStepParam where step in($steps_str)").executeUpdate()
      SQL(s"DELETE from ProtocolStep where experiment=$id").executeUpdate()
      SQL(s"DELETE from ProtocolSample where experiment=$id").executeUpdate()
      SQL(s"DELETE from ExpRun where experiment=$id").executeUpdate()
      SQL(s"DELETE from Experiment where owner=$owner and id=$id").executeUpdate()
      Right("Done")
    }catch{
      case e: Throwable => Left(e.getMessage)
    }
  }

  def getFull(id: Id)(implicit c: Connection): Option[Experiment] = {
    val e: Option[Experiment] = get(id)
    e match {
      case Some(exp) =>{
        val runs: Array[ExpRun] = getRuns(id)
        val pss: Array[ProtocolSample] = getProtocolSamples(id)
        val steps: Array[ProtocolStep] = getProtocolSteps(id)
        val rss: Map[(Id,Id),Sample] = getRunSamplesKeyValue(id)
        Some(exp.copy(runs = runs, protocolSamples = pss, protocolSteps = steps, runSamples = rss))
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

  //@Transaction
  def createProtocolStep(id: Id, name: String, ins: Array[Id], outs: Array[Id])(implicit c: Connection): Either[String,Id] = {
    val o_step_id: Option[Id] = SQL(s"INSERT into ProtocolStep(experiment,name) values($id,'${escape(name)}')").executeInsert()
    o_step_id match {
      case Some(step_id) => {
        try{
          for(i <- ins){
            val r: Long = SQL(s"INSERT into ProtocolSampleInStep(step,sample,role) values($step_id,$i,'input')").executeUpdate()
            if(r != 1l)
              throw new Exception("Insertion failed")
          }
          for(o <- outs){
            val r: Long = SQL(s"INSERT into ProtocolSampleInStep(step,sample,role) values($step_id,$o,'output')").executeUpdate()
            if(r != 1l)
              throw new Exception("Insertion failed")
          }
          Right(step_id)
        }catch{
          case e: Throwable => Left("DB error: " + e.getMessage)
        }
      }
      case _ =>
        Left("DB error")
    }
  }

  //@Transaction
  def updateProtocolStep(step_id: Id, o_name: Option[String], o_ins: Option[Array[Id]], o_outs: Option[Array[Id]])(implicit c: Connection): Either[String,Id] = {
    o_name.map{name =>
      SQL(s"UPDATE ProtocolStep SET name='${escape(name)}' where id=$step_id").executeUpdate()
    }
    try{
      Logger.debug(step_id.toString)
      println(o_ins)
      println(o_outs)
      o_ins.map{ins =>
        val r: Long = SQL(s"DELETE from ProtocolSampleInStep where step=$step_id and role='input'").executeUpdate()
        for(i <- ins){
          val r: Long = SQL(s"INSERT into ProtocolSampleInStep(step,sample,role) values($step_id,$i,'input')").executeUpdate()
        }
      }
      o_outs.map{outs =>
        val r: Long = SQL(s"DELETE from ProtocolSampleInStep where step=$step_id and role='output'").executeUpdate()
        for(o <- outs){
          val r: Long = SQL(s"INSERT into ProtocolSampleInStep(step,sample,role) values($step_id,$o,'output')").executeUpdate()
        }
      }
      Right(step_id)
    }catch{
      case e: Throwable => Left("DB error: " + e.getMessage)
    }
  }
  //@Transaction
  def createRunSample(rid: Id, pid: Id, name: String, tid2: Option[Id])(implicit c: Connection): Option[Id] = {
      val o_tid = tid2 match {
        case None => ProtocolSampleAccess().sampleTypeId(pid)
        case Some(t) => Some(t)
      }
      o_tid.flatMap{tid =>
        try{
          val o_id: Option[Id] = SQL(s"INSERT into Sample(owner,name,type) values($owner,'${escape(name)}',$tid)").executeInsert()
          o_id.flatMap{ id =>
            SQL(s"INSERT into SampleInRun(sample,protocol_sample,run) values($id,$pid,$rid)").executeInsert()
          }
          o_id
        }catch {
          case e: Throwable =>
            None
        }
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
    val vs = SQL(s"SELECT * from ProtocolSample LEFT JOIN ProtocolSampleInStep on ProtocolSample.id=ProtocolSampleInStep.sample where ProtocolSample.experiment=$eid")().map{ row =>
      val ps = ProtocolSample.fromRow(full = true)(row)
      val role = row[Option[String]]("ProtocolSampleInStep.role")
      ps.copy(role = role.map(Array(_)).getOrElse(Array()))
    }.toArray
    val vs2: Map[Id, Array[ProtocolSample]] = vs.groupBy{ v =>
      v.id
    }
    vs2.values.map{(vs: Array[ProtocolSample]) =>
      val ps = vs.head
      val role: Array[String] = vs.flatMap(_.role).distinct
      ps.copy(role = role)
    }.toArray
  }

  //@Transaction
  def deleteProtocolSample(pid: Id, force: Boolean = false)(implicit c: Connection): Either[String,String] = {
      if(force || SQL(s"SELECT count(*) as c from SampleInRun where protocol_sample=$pid")().map(_[Long]("c")).headOption == Some(0l)){
        //FIXME: Need to delete all protocol params etc.
        SQL(s"DELETE from ProtocolSampleInStep where sample=$pid").executeUpdate()

        SQL(s"DELETE from SampleInRun where protocol_sample=$pid").executeUpdate()
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

  def getProtocolSteps(id: Id)(implicit c: Connection): Array[ProtocolStep] = {
    val step_ids = SQL(s"SELECT * from ProtocolStep where experiment=$id")().map{row =>
      row[Id]("id")
    }.toArray
    Logger.debug(step_ids.mkString(","))
    step_ids.map(id => models.ProtocolStepAccess().get(id)).flatten
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

case class ProtocolSample(id: Id, name: String, note: String = "", typ: Either[Id,SampleType] = Left(SampleType.AnyType.id), role: Array[String] = Array())

object ProtocolSample {
  def fromRow(full: Boolean = false)(row: Row)(implicit c: Connection): ProtocolSample = {
    val tid = row[Id]("type")
    val t = if(full) Right(SampleTypeAccess().get(tid).get) else Left(tid)
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


  //@Transaction
  def update(psid: Id, o_name: Option[String], o_typ: Option[Id])(implicit c: Connection): Either[String, ProtocolSample] = {
    val s_name: Array[String] = o_name.map(name => Array(s"name='${escape(name)}'")).getOrElse(Array())
    val s_typ: Array[String] = o_typ.map(typ => Array(s"type=${typ}")).getOrElse(Array())
    val str = (s_name++s_typ).mkString(",")
    if(str == ""){
      Left("Params missing.")
    }else{
      try{
        if(1 == SQL(s"UPDATE ProtocolSample SET $str where id=$psid").executeUpdate()){
          val ps = ProtocolSampleAccess().get(psid)
          ps.map(s => Right(s)).getOrElse(Left("Error"))
        }else{
          Left("Not found.")
        }
      }catch{
        case e: Throwable =>{
          println(e.getMessage)
          Left("DB error.")
        }
      }
    }
  }

  def setName(id: Id, name: String, owner: Option[Id] = None)(implicit c: Connection): Boolean = {
        1 == SQL(s"UPDATE ProtocolSample SET name='${escape(name)}' where id=$id").executeUpdate()
  }

  def listInExp(eid: Id)(implicit c: Connection): Stream[ProtocolSample] = {
      SQL(s"SELECT * from ProtocolSample where experiment=$eid")().map(ProtocolSample.fromRow(full = true))
  }

  def get(psid: Id)(implicit c: Connection): Option[ProtocolSample] = {
    SQL(s"SELECT * from ProtocolSample where id=$psid")().map(ProtocolSample.fromRow(full = true)).headOption
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
       SQL(s"SELECT * from SampleType where owner=$owner and id=$id")().map(SampleType.fromRow).headOption
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

  def findExps(id: Id)(implicit c: Connection): Array[Experiment] = {
    SQL("SELECT Experiment.* from Experiment inner join ExpRun on ExpRun.experiment=Experiment.id " +
      "inner join SampleInRun on ExpRun.id=SampleInRun.run " +
      s"inner join Sample on SampleInRun.sample=Sample.id where Sample.id=$id"
    )().map(Experiment.fromRow).toArray
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

case class ProtocolStepParam(id: Id, name: String, typ: ParamType.ParamType, unit: Option[String])
case class RunStepParam(id: Id, name: String, value: String, typ: String, unit: String)

case class StepParamAccess(owner: Id) {
  val dbname = "StepParam"
}

case class ProtocolStep(
           id: Id,
           name: String,
           input: Array[Either[Id, ProtocolSample]],
           output: Array[Either[Id, ProtocolSample]],
           params: Array[ProtocolStepParam] = Array())

object ParamType extends Enumeration {
    type ParamType = Value
    val Text, Number, Mass, Volume, Area, Length, Time, Duration, Temperature = Value

  def read(s: String): Option[ParamType] = {
    s match {
      case "text" => Some(Text)
      case "number" => Some(Number)
      case "mass" => Some(Mass)
      case "volume" => Some(Volume)
      case "area" => Some(Area)
      case "length" => Some(Length)
      case "time" => Some(Time)
      case "duration" => Some(Duration)
      case "temperature" => Some(Temperature)
      case _ => None
    }
  }
  def show(s: ParamType): String = {
    s.toString.toLowerCase
  }
}

case class ProtocolStepAccess() {
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

  def get(id: Id, full: Boolean = false)(implicit c: Connection): Option[ProtocolStep] = {
    val vs = SQL(s"SELECT * from ProtocolStep ps inner join ProtocolSampleInStep pss on ps.id=pss.step where ps.id=$id")().map{row =>
      (row[String]("name"), row[Id]("ProtocolSampleInStep.sample"),row[String]("ProtocolSampleInStep.role"))
    }.toArray
    if(vs.isEmpty){
      None
    }else{
      val input_ids: Array[Id] = vs.filter{ v =>
       v._3 == "input"
      }.map(_._2)
      val output_ids: Array[Id] = vs.filter{ v =>
        v._3 == "output"
      }.map(_._2)
      if(full){
        Some(ProtocolStep(
          id = id,
          name = vs.head._1,
          input = input_ids.map{id =>
            Right(ProtocolSampleAccess().get(id).get)
          },
          output = output_ids.map{id =>
            Right(ProtocolSampleAccess().get(id).get)
          },
          params = getParams(id)))
      }else {
        Some(ProtocolStep(id = id, name = vs.head._1,
          input = input_ids.map(Left(_)),
          output = output_ids.map(Left(_)),
          params = getParams(id)
        ))
      }
    }
  }

  def getParam(param_id: Id)(implicit c: Connection): Option[ProtocolStepParam] = {
    import ParamType._
    SQL(s"SELECT * from ProtocolStepParam where id=$param_id")().map{row =>
      ProtocolStepParam(id = row[Long]("id"),
        name = row[String]("name"),
        typ = row[Option[String]]("param_type").flatMap(read).getOrElse(Text),
        unit = row[Option[String]]("unit"))
    }.headOption
  }

  def getParams(step_id: Id)(implicit c: Connection): Array[ProtocolStepParam] = {
    import ParamType._
    SQL(s"SELECT * from ProtocolStepParam where step=$step_id")().map{row =>
      ProtocolStepParam(id = row[Long]("id"),
        name = row[String]("name"),
        typ = row[Option[String]]("param_type").flatMap(read).getOrElse(Text),
        unit = row[Option[String]]("unit"))
    }.toArray
  }

  def deleteParam(param_id: Id)(implicit c: Connection): Either[String,String] = {
    if(1 == SQL(s"DELETE ProtocolStepParam where id=$param_id").executeUpdate()){
      Right("done")
    }else{
      Left("Deletion failed.")
    }
  }

  //@Transaction
  def delete(id: Id)(implicit c: Connection): Either[String,String] = {
    try{
      val r = SQL(s"DELETE ProtocolSampleInStep where step=$id").executeUpdate()
      val r2 = SQL(s"DELETE ProtocolStep where id=$id").executeUpdate()
      Right("")
    }catch{
      case e: JdbcSQLException =>
        Left(e.getMessage)
    }
  }

  import ParamType._

  def createParam(step: Id, name: String,
                  typ: ParamType = Text, unit: String = "")(implicit c: Connection): Either[String,Id] = {
    val r: Option[Id] = SQL("INSERT into ProtocolStepParam(step,name,param_type,unit) "+
      s"values ($step,'${escape(name)}','${escape(typ.toString)}','${escape(unit)}')").executeInsert()
    r match {
      case Some(id) => Right(id)
      case _ => Left("DB error.")
    }
  }

  def updateParam(param_id: Id, o_name: Option[String],
                  o_typ: Option[ParamType],
                  o_unit: Option[String])(implicit c: Connection): Either[String,ProtocolStepParam] = {
    val s_name: Array[String] = o_name.map(name => Array(s"name='${escape(name)}'")).getOrElse(Array())
    val s_typ: Array[String] = o_typ.map(typ => Array(s"param_type='${show(typ)}'")).getOrElse(Array())
    val s_unit: Array[String] = o_unit.map(typ => Array(s"unit='${escape(typ)}'")).getOrElse(Array())
    val str = (s_name++s_typ++s_unit).mkString(",")
    if(1l == SQL(s"UPDATE ProtocolStepParam SET $str where id=$param_id").executeUpdate()){
      Right(getParam(param_id).get)
    }else{
      Left("Update failed.")
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
          "INSERT into ProtocolStepParam(step,name,param_type,unit) " +
            s"values($ps1,'${escape(p.name)}','$p.typ','$p.unit')")
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

  import ParamType._
  implicit val implicitParamTypeWrites = new Writes[ParamType.ParamType] {
    def writes(p: ParamType.ParamType): JsValue = Json.toJson(show(p))
  }

  implicit val implicitProtocolStepParamWrites = Json.writes[ProtocolStepParam]

  implicit val implicitProtocolStepWrites2 = new Writes[Either[models.Database.Id, models.ProtocolSample]] {
    def writes(e: Either[models.Database.Id, models.ProtocolSample]): JsValue = {
      e match {
        case Left(id) => {
          Json.toJson(id)
        }
        case Right(s) => {
          Json.toJson(s)
        }
      }
    }
  }


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

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
import java.io.{ByteArrayOutputStream, OutputStream}

object Database {
  type Id = Long
  def escape(s: String) = s.replace("'","''")
  def escapeName(s: String) = if(!validName(s)) throw new IllegalArgumentException("Name is invalid.") else s.replace("'","''")
  def validName(s: String) = s.trim != ""
  val sandboxUserId: Id = 0l
}

import Database.Id
import Database.{escape,escapeName}

case class User (id: Id, email: String, firstName: String, lastName: String)

case class UserAccess() {
  def listUserIDs(implicit c: Connection): Array[Id] = {
    SQL(s"SELECT id from User")().map(_[Id]("id")).toArray
  }
  def addUser(email: String)(implicit c: Connection): Option[Id] = {
    SQL(s"INSERT into User(email) values('${escape(email)}')").executeInsert()
  }
  //Add and setup.
  def setupUser(email: String, addInitialData: Boolean = false)(implicit c: Connection): Option[Id] = {
    addUser(email) match {
      case None => None
      case Some(uid) => {
        SQL(s"INSERT into SampleType(owner,name,system) values($uid,'Any',true)").executeInsert()
        if(addInitialData){
          models.SampleDatabase(Some(uid)).setup()
        }
        Some(uid)
      }
    }
  }

}

case class Experiment (
                       id: Id,
                       owner: Id,
                       name: String,
                       protocolSamples: Array[ProtocolSample] = Array(),
                       protocolSteps: Array[ProtocolStep] = Array(),
                       runs: Array[ExpRun] = Array(),
                       note: String = "",
                       runSamples: Map[(Id,Id),Sample] = Map(),
                       runSteps: Map[(Id,Id),RunStep] = Map()
                       ){
  def mkCsv: String = {
    import org.apache.poi.hssf.usermodel._
    import org.apache.commons.codec.binary.Base64OutputStream

    val wb = new HSSFWorkbook
    val sheet = wb.createSheet("Summary")
    val createHelper = wb.getCreationHelper

    val row = sheet.createRow(0)
    row.createCell(1).setCellValue(createHelper.createRichTextString(this.name))
    row.createCell(2).setCellValue("ID: " + id.toString)
    sheet.autoSizeColumn(0)
    sheet.autoSizeColumn(1)


    val byteOut = new ByteArrayOutputStream
    val out = new Base64OutputStream(byteOut)
    wb.write(out)
    out.close()
    byteOut.toString
  }
}

object Experiment {
  def fromRow(row: Row) = {
    Experiment(
      id = row[Id]("id"),
      name = row[Option[String]]("name").getOrElse("(N/A)"),
      owner = row[Id]("owner")
    )
  }
}

case class ExperimentAccess(o_owner: Option[Id]) {
  val owner: Id = o_owner.getOrElse(Database.sandboxUserId)

  def list(implicit c: Connection): Array[Experiment] = {
    println("ExperimentAccess.list")
    println(o_owner,owner)
    SQL(s"Select * from Experiment where owner=$owner order by id")().map( row => {
      models.Experiment(
        id = row[Long]("id"),
        name = row[Option[String]]("name").getOrElse("(N/A)"),
        owner =  row[Database.Id]("owner")
      )
    }).toArray
  }
  def create(name: String)(implicit c: Connection): Option[Id] = {
    SQL(s"INSERT into Experiment(owner,name) values($owner,'${escapeName(name)}')").executeInsert()
  }

  def setName(id: Id, name: String)(implicit c: Connection): Boolean = {
    if(name.trim == ""){
      false
    }else{
      1 == SQL(s"UPDATE Experiment SET name='${escapeName(name)}' where owner=$owner and id=$id").executeUpdate()
    }
  }

  def countTotal(implicit c: Connection): Long = {
    SQL(s"SELECT count(*) as c from Experiment where owner=$owner")().map(_[Long]("c")).headOption.getOrElse(0l)
  }

  //@Transaction
  def delete(id: Id)(implicit c: Connection): Either[String,String] = {
    try{
      val ridstr = SQL(s"SELECT id from ExpRun where experiment=$id")().map(_[Id]("id")).mkString(",")
      SQL(s"DELETE from SampleInRun where run in($ridstr)").executeUpdate()
      val steps_str = SQL(s"SELECT id from ProtocolStep where experiment=$id")().map(_[Id]("id")).mkString(",")
      SQL(s"DELETE from ProtocolSampleInStep where step in($steps_str)").executeUpdate()
      SQL(s"DELETE from ProtocolStepParam where step in($steps_str)").executeUpdate()
      SQL(s"DELETE from RunStep where protocol_step in($steps_str)").executeUpdate()
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
        val rsteps: Map[(Id,Id),RunStep] = getRunStepsKeyValue(id)
        Some(exp.copy(runs = runs, protocolSamples = pss, protocolSteps = steps, runSamples = rss, runSteps = rsteps))
      }
      case _ =>
        None
    }
  }

  def get(id: Id,
          with_runs: Boolean = false,
          with_psamples: Boolean = false)(implicit c: Connection): Option[Experiment] = {
      val exp: Option[models.Experiment] =
        SQL(s"Select * from Experiment where id=$id and owner=$owner limit 1")()
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
    val o_step_id: Option[Id] = SQL(s"INSERT into ProtocolStep(experiment,name) values($id,'${escapeName(name)}')").executeInsert()
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
      SQL(s"UPDATE ProtocolStep SET name='${escapeName(name)}' where id=$step_id").executeUpdate()
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
        case None => ProtocolSampleAccess(o_owner).sampleTypeId(pid)
        case Some(t) => Some(t)
      }
      o_tid.flatMap{tid =>
        try{
          val o_id: Option[Id] = SQL(s"INSERT into Sample(owner,name,type) values($owner,'${escapeName(name)}',$tid)").executeInsert()
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
          val s = SampleAccess(o_owner).get(sid).get
          ((r,p),s)
        }
      ss.toMap
  }

  def getRunSamples(eid: Id)(implicit c: Connection): Array[Sample] = {
    getRunSamplesKeyValue(eid).values.toArray
  }

  def getRunStepsKeyValue(eid: Id)(implicit c: Connection): Map[(Id,Id),RunStep] = {
    val ids = SQL(s"SELECT id from ExpRun where experiment=$eid")().map(_[Id]("id"))
    ids.map{run_id =>
      val steps: Array[RunStep] = ExpRunAccess(o_owner).getRunSteps(run_id)
      steps.map{step =>
        ((run_id,step.step),step)
      }
    }.flatten.toMap
  }

  def addRun(eid: Id, name: String)(implicit c: Connection): Option[Id] = {
    ExpRunAccess(o_owner).create(eid, name)
  }

  def getRuns(eid: Id)(implicit c: Connection): Array[ExpRun] = {
    SQL(s"SELECT * from ExpRun where experiment=$eid")().map(ExpRun.fromRow).toArray
  }

  def addProtocolSample(eid: Id, name: String, tid: Id)(implicit c: Connection): Option[Id] = {
    ProtocolSampleAccess(o_owner).create(eid,name,tid)
  }

  def getProtocolSamples(eid: Id)(implicit c: Connection): Array[ProtocolSample] = {
    val s = s"SELECT * from ProtocolSample INNER JOIN Experiment ON ProtocolSample.experiment=Experiment.id where Experiment.id=$eid and Experiment.owner=$owner"
    val samples: Array[ProtocolSample] = SQL(s)().map{row =>
      val tid = row[Id]("ProtocolSample.type")
    val s2 = s"SELECT * from SampleType where id=$tid and owner=$owner"
    Logger.debug(s2)
      val t = SQL(s2)().map(SampleType.fromRow).headOption
      val typ = Right(t.get)

      ProtocolSample(
        row[Id]("ProtocolSample.id"),
        row[String]("ProtocolSample.name"),
        row[Option[String]]("ProtocolSample.note").getOrElse(""),
        typ
      )
    }.toArray

    samples.map{sample =>
      val role: Array[String] = Array()
      sample.copy(role = role)
    }
  }

  //@Transaction
  def deleteProtocolSample(pid: Id, force: Boolean = false)(implicit c: Connection): Either[String,String] = {
      if(SQL(s"SELECT count(*) as c from ProtocolSample inner join Experiment on ProtocolSample.experiment=Experiment.id where ProtocolSample.id=$pid and Experiment.owner=$owner")()
        .map(_[Long]("c")).headOption != Some(1l))
        return Left("Not found or not owner.")

      if(force || SQL(s"SELECT count(*) as c from SampleInRun where protocol_sample=$pid")().map(_[Long]("c")).headOption == Some(0l)){
        //FIXME: Need to delete all protocol params etc.
        SQL(s"DELETE from ProtocolSampleInStep where sample=$pid").executeUpdate()

        /*
DELETE
FROM ProtocolSample
where exists
(select * from protocolsample inner join experiment on protocolsample.experiment=experiment.id where experiment.owner=1 and protocolsample.id=18)

        */
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
    step_ids.map(id => models.ProtocolStepAccess(o_owner).get(id)).flatten
  }

  //Run samples
  def countRunSamples(rid: Id, pid: Id)(implicit c: Connection): Long = {
      SQL("SELECT COUNT(*) as c from SampleInRun where run={r} and protocol_sample={p}")
              .on('r -> rid, 'p -> pid)().map(_[Long]("c")).head
  }

  def assignExistingSample(rid: Id, pid: Id, sid: Id)(implicit c: Connection): Boolean = {
      val count: Long = countRunSamples(rid,pid)
    try{
      if(true || count == 0){
        //This table does not have ID.
        SQL(s"INSERT into SampleInRun(sample,protocol_sample,run) values($sid,$pid,$rid)").executeInsert()
        true
      }else{
        Logger.debug("Already exists.")
        false
      }
    }catch{
      case e: Throwable =>{
        Logger.debug(e.getMessage)
        false
      }
    }
  }

  //Only allows one runsample per (rid,pid) point.
  def assignNewSample(rid: Id, pid: Id, sname: String, typ: Id)(implicit c: Connection): Option[Id] = {
      val o_sid = SampleAccess(o_owner).create(sname,typ)
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

case class ProtocolSample(id: Id, name: String, note: String = "", typ: Either[Id,SampleType], role: Array[String] = Array())

object ProtocolSample {
  def fromRow(o_owner: Option[Id], full: Boolean = false)(row: Row)(implicit c: Connection): ProtocolSample = {
    val tid = row[Id]("type")
    val typ = if(full) {
      var ot = SampleTypeAccess(o_owner).get(tid)
      Right(ot.get)
    }else Left(tid)

    ProtocolSample(
      row[Id]("id"),
      row[String]("name"),
      row[Option[String]]("note").getOrElse(""),
      typ
    )
  }
}

case class ProtocolSampleAccess(o_owner: Option[Id]) {
  val owner: Id = o_owner.getOrElse(Database.sandboxUserId)
  val dbname = "ProtocolSample"

  def create(eid: Id, name: String, tid: Id)(implicit c: Connection): Option[Id] = {
     SQL(s"INSERT into ProtocolSample(name,experiment,type) values('${escapeName(name)}',$eid,$tid)").executeInsert()
  }


  //@Transaction
  def update(psid: Id, o_name: Option[String], o_typ: Option[Id])(implicit c: Connection): Either[String, ProtocolSample] = {
    val s_name: Array[String] = o_name.map(name => Array(s"name='${escapeName(name)}'")).getOrElse(Array())
    val s_typ: Array[String] = o_typ.map(typ => Array(s"type=${typ}")).getOrElse(Array())
    val str = (s_name++s_typ).mkString(",")
    if(str == ""){
      Left("Params missing.")
    }else{
      try{
        if(1 == SQL(s"UPDATE ProtocolSample SET $str where id=$psid").executeUpdate()){
          val ps = ProtocolSampleAccess(o_owner).get(psid)
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
        1 == SQL(s"UPDATE ProtocolSample SET name='${escapeName(name)}' where id=$id").executeUpdate()
  }

  def listInExp(eid: Id)(implicit c: Connection): Stream[ProtocolSample] = {
      SQL(s"SELECT * from ProtocolSample where experiment=$eid")().map(ProtocolSample.fromRow(o_owner = o_owner, full = true))
  }

  def get(psid: Id)(implicit c: Connection): Option[ProtocolSample] = {
    SQL(s"SELECT * from ProtocolSample where id=$psid")().map(ProtocolSample.fromRow(o_owner = o_owner, full = true)).headOption
  }

  def sampleTypeId(psid: Id)(implicit c: Connection): Option[Id] = {
    SQL(s"SELECT type from ProtocolSample where id=$psid")().map(_[Id]("type")).headOption
  }
  def sampleType(psid: Id)(implicit c: Connection): Option[SampleType] = {
    SQL(s"SELECT type from ProtocolSample where id=$psid")().map(_[Id]("type")).headOption.flatMap{ t =>
      SampleTypeAccess(o_owner).get(t)
    }
  }
}

case class SampleType(id: Id, name: String, parent: Option[Id])

object SampleType {
  def getAnyTypeId(u: Option[Id])(implicit c: Connection): Id = {
    val uid = u.getOrElse(Database.sandboxUserId)
    SQL(s"SELECT id from SampleType where owner=$uid and name='Any' and system=true")().map(_[Id]("id")).head
  }
  def getAnyType(u: Option[Id])(implicit c: Connection): SampleType = {
    val uid = u.getOrElse(Database.sandboxUserId)
    SQL(s"SELECT * from SampleType where owner=$uid and name='Any' and system=true")().map(SampleType.fromRow).head
  }
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

case class SampleTypeAccess(o_owner: Option[Id]) {
  val owner: Id = o_owner.getOrElse(Database.sandboxUserId)
  val dbname = "SampleType"

  def getAnyTypeId(implicit c: Connection): Id = {
    SQL(s"SELECT id from SampleType where name='Any' and owner=$owner")().map(_[Id]("id")).head
  }

  def getAnyType(implicit c: Connection): SampleType = {
    SQL(s"SELECT * from SampleType where name='Any' and owner=$owner")().map(SampleType.fromRow).head
  }

  def create(name: String, parent: Id, system: Boolean = false)(implicit c: Connection): Option[Id] = {
    val exists = 0 < SQL(s"SELECT count(*) as c from SampleType where exists" +
       s" (SELECT * from SampleType where owner=$owner and name='${escapeName(name)}')")().map(_[Long]("c")).head
    if(!exists) {
      SQL(s"INSERT into SampleType(owner,name,parent,system) values($owner,'${escapeName(name)}',$parent,$system)").executeInsert()
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
    if(isSystemType(id)){
      false
    }else if(hasSamples(id,subtypes)){
      false
    }else {
      val tids = if(subtypes) findDescendantsId()(id) else Array(id)
      val str = tids.mkString(",")
      0 < SQL(s"DELETE from SampleType where id in($str)").executeUpdate()
    }
  }

  def isSystemType(id: Id)(implicit c: Connection): Boolean = {
    SQL(s"SELECT * from SampleType where id=$id")().map(_[Boolean]("system")).headOption == Some(true)
  }

  def hasSamples(id: Id,subtypes: Boolean = true)(implicit c: Connection): Boolean = {
    val tids = if(subtypes) findDescendantsId()(id) else Array(id)
    val str = tids.mkString(",")
    0 < SQL(s"SELECT count(*) as c from Sample where exists" +
      s" (SELECT * from Sample where type in($str))")().map(_[Long]("c")).head
  }

  def getOrCreate(name: String, parent: Id)(implicit c: Connection): Option[Id] = {
    val o_st = SQL(s"SELECT * from SampleType where owner=$owner and name='${escapeName(name)}'")()
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

case class ExpRunAccess(o_owner: Option[Id]) {
  val owner: Id = o_owner.getOrElse(Database.sandboxUserId)
  val dbname = "ExpRun"

  def create(eid: Id, name: String)(implicit c: Connection): Option[Id] = {
    SQL(s"INSERT into ExpRun(name,experiment) values('${escapeName(name)}',$eid)").executeInsert()
  }

  def setName(id: Id, name: String, owner: Option[Id] = None)(implicit c: Connection): Boolean = {
    if(name.trim == ""){
      false
    }else{
      1 == SQL(s"UPDATE Experiment SET name='${escapeName(name)}' where id=$id").executeUpdate()
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

  def createRunStep(run: Id, pstep: Id, o_time: Option[Long])(implicit c: Connection): Either[String,Id] = {
    val tk = o_time.map(_ => ",time_at").getOrElse("")
    val tv = o_time.map(","+_.toString).getOrElse("")
    val id: Option[Id] = SQL(s"INSERT into RunStep(run,protocol_step$tk) values($run,$pstep$tv)").executeInsert()
    id.map(Right(_)).getOrElse(Left("Insertion failed."))
  }

  def getRunSteps(run_id: Id)(implicit c: Connection): Array[RunStep] = {
    SQL(s"SELECT * from RunStep where run=$run_id")().map(RunStep.fromRow(o_owner = o_owner, full = true)).toArray
  }

}

case class SampleData(id: Id, name: String, url: String, typ: Option[String], icon: Option[String] = None, note: Option[String] = None,
                       original_id: Option[String] = None)

object SampleData {
  def fromRow(row: Row): SampleData = {
    SampleData(id = row[Id]("id"),
      name = row[String]("name"),
      url = row[String]("url"),
      typ = row[Option[String]]("type"),
      icon = row[Option[String]]("icon"),
      note = row[Option[String]]("note"),
      original_id = row[Option[String]]("original_id"))
  }
}
case class Sample(id: Id, owner: Id, name: String, typ: Either[Id,SampleType], note: String = "", data: Array[SampleData] = Array())

object Sample {
  //Caution: Always use join query to include sampletype.
  def fromRow(row: Row)(implicit c: Connection): Sample = {
    val t = SampleType(id = row[Id]("sampletype.id"), name = row[String]("sampletype.name"), parent = row[Option[Id]]("sampletype.parent"))

    val id = row[Id]("sample.id")
    val data = SQL(s"SELECT * from SampleData where sample=$id")().map(SampleData.fromRow).toArray

    Sample(id = id, owner=row[Id]("owner"), name=row[String]("sample.name"), typ = Right(t), data = data)
  }
}

case class SampleAccess(o_owner: Option[Id]) {
  val owner: Id = o_owner.getOrElse(Database.sandboxUserId)
  val dbname = "Sample"

  def get(id: Id)(implicit c: Connection): Option[Sample] = {
      SQL(s"SELECT * from Sample inner join sampletype on sample.type=sampletype.id " +
        s"where sample.owner=$owner and sample.id=$id")().map(Sample.fromRow).headOption
  }

  def list(implicit c: Connection): Array[Sample] = {
    SQL(s"SELECT * from sample inner join sampletype " +
      s"on sample.type = sampletype.id where sample.owner=$owner")().map(Sample.fromRow).toArray
  }

  def findExps(id: Id)(implicit c: Connection): Array[Experiment] = {
    SQL("SELECT DISTINCT Experiment.* from Experiment inner join ExpRun on ExpRun.experiment=Experiment.id " +
      "inner join SampleInRun on ExpRun.id=SampleInRun.run " +
      s"inner join Sample on SampleInRun.sample=Sample.id where Sample.id=$id"
    )().map(Experiment.fromRow).toArray
  }

  def countTotal(implicit c: Connection): Long = {
    SQL(s"SELECT count(*) as c from Sample where owner=$owner")().map(_[Long]("c")).headOption.getOrElse(0l)
  }

  def create(name: String, tid: Id)(implicit c: Connection): Option[Id] = {
    if(name.trim == ""){
      None
    }else{
      SQL(s"INSERT into Sample(owner,name,type) values($owner,'${escapeName(name)}',$tid)").executeInsert()
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
      1 == SQL(s"UPDATE Sample SET name='${escapeName(name)}' where id=$id").executeUpdate()
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
          SampleTypeAccess(o_owner).findDescendantsId()(tid).mkString(",")
        else
          tid.toString
      SQL(s"SELECT * from sampletype inner join sample " +
        s"on sample.type = sampletype.id where sampletype.id in($str) and sample.owner=$owner")().map{row =>
        val tid = row[Id]("sampletype.id")
        val t = SampleType(tid,row[String]("sampletype.name"),row[Option[Id]]("parent"))
        Sample(name = row[String]("sample.name"), owner = row[Id]("sample.owner"), id=row[Id]("sample.id"), typ = Right(t))
      }.toArray
    }
  }

  //Count samples of SampleType of tid (and subtypes).
  def findCompatibleSampleCount(tid: Id, subtypes: Boolean)(implicit c: Connection): Long = {
      val str =
        if(subtypes)
          (SampleTypeAccess(o_owner).findDescendantsId()(tid) ++ Array(tid)).mkString(",")
        else
          tid.toString
      SQL(s"SELECT count(*) as c from sampletype inner join sample " +
        s"on sample.type = sampletype.id where sampletype.id in($str);")()
        .map(_[Long]("c")).headOption.getOrElse(0)
  }


  def addData(id: Id, url: String, name: String, typ: String,
              icon: Option[String] = None, note: Option[String] = None,
               originalId: Option[String] = None)(implicit c: Connection): Option[Long] = {
    val k_icon = if(icon.isDefined) ",icon" else ""
    val k_note = if(note.isDefined) ",note" else ""
    val k_id = if(originalId.isDefined) ",original_id" else ""
    val k = k_icon + k_note + k_id
    val v_icon = icon.map(s => ",'%s'".format(escape(s))).getOrElse("")
    val v_note = note.map(s => ",'%s'".format(escape(s))).getOrElse("")
    val v_id = originalId.map(s => ",'%s'".format(escape(s))).getOrElse("")
    val v = v_icon + v_note + v_id
    SQL(s"INSERT into SampleData(sample,url,name,type$k) values ($id, '${escapeName(url)}','${escapeName(name)}','$typ'$v)").executeInsert()
  }

  def deleteData(data_id: Id)(implicit c: Connection): Boolean = {
    1 == SQL(s"DELETE SampleData where id=$data_id").executeUpdate()
  }

  def getData(data_id: Id)(implicit c: Connection): Option[SampleData] = {
    SQL(s"SELECT * from SampleData where id=$data_id")().map(SampleData.fromRow).headOption
  }

}

case class ProtocolStepParam(id: Id, name: String, typ: ParamType.ParamType, unit: Option[String])

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

case class ProtocolStepAccess(o_owner: Option[Id]) {
  val owner: Id = o_owner.getOrElse(Database.sandboxUserId)
  val dbname = "ProtocolStep"

  def create(eid: Id, name: String,input: Array[Id],
             output: Array[Id], params: Array[ProtocolStepParam])(implicit c: Connection): Option[Id] = {
    if(name.trim == ""){
      None
    }else{
      val ps1: Option[Id] = SQL(s"INSERT into ProtocolStep(experiment,name) values($eid,'${escapeName(name)}')").executeInsert()
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
            Right(ProtocolSampleAccess(o_owner).get(id).get)
          },
          output = output_ids.map{id =>
            Right(ProtocolSampleAccess(o_owner).get(id).get)
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

  def deleteParam(param_id: Id, force: Boolean = false)(implicit c: Connection): Either[String,String] = {
    try{
      val runparams: Array[Id] = SQL(s"SELECT id from RunStepParam where param=$param_id")().map(_[Id]("id")).toArray
      if(runparams.length > 0){
        if(force){
          SQL(s"DELETE RunStepParam where param=$param_id").executeUpdate()
        }else{
          return Left("There are still run params.")
        }
      }
      val r3 = SQL(s"DELETE ProtocolStepParam where id=$param_id").executeUpdate()
      Right("")
    }catch{
      case e: JdbcSQLException =>
        Left(e.getMessage)
    }
  }

  //@Transaction
  def delete(id: Id, force: Boolean = false)(implicit c: Connection): Either[String,String] = {
    try{
      val runsteps: Array[Id] = SQL(s"SELECT id RunStep where protocol_step=$id")().map(_[Id]("id")).toArray
      if(runsteps.length > 0){
        if(force){
          val str = runsteps.mkString(",")
          SQL(s"DELETE RunStepParam where protocol_step in ($str)").executeUpdate()
          SQL(s"DELETE RunStep where protocol_step=$id").executeUpdate()
        }else{
          return Left("There are still run steps.")
        }
      }
      val r1 = SQL(s"DELETE ProtocolStepParam where step=$id").executeUpdate()
      val r2 = SQL(s"DELETE ProtocolSampleInStep where step=$id").executeUpdate()
      val r3 = SQL(s"DELETE ProtocolStep where id=$id").executeUpdate()
      Right("")
    }catch{
      case e: JdbcSQLException =>
        Left(e.getMessage)
    }
  }

  import ParamType._

  def createParam(step: Id, name: String,
                  typ: ParamType = Text, unit: String = "")(implicit c: Connection): Either[String,Id] = {
    try{
      val r: Option[Id] = SQL("INSERT into ProtocolStepParam(step,name,param_type,unit) "+
        s"values ($step,'${escapeName(name)}','${escape(typ.toString)}','${escape(unit)}')").executeInsert()
      r match {
        case Some(id) => Right(id)
        case _ => Left("DB error.")
      }
    }catch{
      case e: Throwable =>
        Left(e.getMessage)
    }
  }

  def updateParam(param_id: Id, o_name: Option[String],
                  o_typ: Option[ParamType],
                  o_unit: Option[String])(implicit c: Connection): Either[String,ProtocolStepParam] = {
    val s_name: Array[String] = o_name.map(name => Array(s"name='${escapeName(name)}'")).getOrElse(Array())
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

case class RunStep(id: Id, run: Id, step: Id, note: Option[String] = None,
                   timeAt: Option[Long] = None, timeEnd: Option[Long] = None,
                    params: Option[Array[RunStepParam]] = None)

case class RunStepParam(id: Id, protocolParam: Id, name: String, value: String, typ: ParamType.ParamType, unit: String)

object RunStep {
  def fromRow(o_owner: Option[Id], full: Boolean)(row: Row)(implicit c: Connection): RunStep = {
    val id = row[Id]("id")
    val params: Option[Array[RunStepParam]] = if(full) Some(RunStepAccess(o_owner).getParams(id)) else None
    RunStep(
      id = id,
      run = row[Id]("run"),
      step = row[Id]("protocol_step"),
      note = row[Option[String]]("note"),
      timeAt = row[Option[Long]]("time_at"),
      timeEnd = row[Option[Long]]("time_end"),
      params = params
    )
  }
}

case class RunStepAccess(o_owner: Option[Id]) {
  val owner: Id = o_owner.getOrElse(Database.sandboxUserId)

  def get(id: Id)(implicit c: Connection): Option[RunStep] = {
    SQL(s"SELECT * from RunStep where id=$id")().map(RunStep.fromRow(o_owner = o_owner, full = true)).headOption
  }

  //@Transaction
  def delete(id: Id)(implicit c: Connection): Either[String,String] = {
    try{
      SQL(s"DELETE RunStepParam where step=$id").executeUpdate()
      SQL(s"DELETE RunStep where id=$id").executeUpdate()
      Right("Done")
    }catch{
      case e: Throwable => {
        c.rollback()
        Left("DB error: "+e.getMessage)
      }
    }
  }

  def updateNote(id: Id, note: String)(implicit c: Connection): Either[String,String] = {
    if(1 == SQL(s"UPDATE RunStep SET note='${escape(note)}' where id=$id").executeUpdate()){
      Right("Done")
    }else{
      Left("DB update failed.")
    }
  }

  def createParam(rid: Id, pid: Id, value: String)(implicit c: Connection): Either[String,Id] = {
    val step = SQL("SELECT RunStep.id from RunStep INNER JOIN ProtocolStep ON RunStep.protocol_step=ProtocolStep.id " +
      s"INNER JOIN ProtocolStepParam ON ProtocolStep.id=ProtocolStepParam.step where RunStep.run=$rid and ProtocolStepParam.id=$pid"
    )().map(_[Id]("RunStep.id")).headOption
    step match {
      case Some(s) =>
        try {
          val id: Option[Id] = SQL(s"INSERT into RunStepParam(step,param,value) values($s,$pid,'${escape(value)}')").executeInsert()
          id match {
            case Some(i) => Right(i)
            case _ => Left("DB error.")
          }
        }catch {
          case e: Throwable => Left(e.getMessage)
        }
      case _ => Left("DB error.")
    }
  }

  def updateParam(rid: Id, pid: Id, value: String)(implicit c: Connection): Either[String,String] = {
    val step: Option[Id] = SQL("SELECT RunStep.id from RunStep INNER JOIN ProtocolStep ON RunStep.protocol_step=ProtocolStep.id " +
      s"INNER JOIN ProtocolStepParam ON ProtocolStep.id=ProtocolStepParam.step where ProtocolStepParam.id=$pid"
    )().map(_[Id]("RunStep.id")).headOption
    step match {
      case Some(s) =>
        if(1 == SQL(s"UPDATE RunStepParam SET value='${escape(value)}' where step=$s and param=$pid").executeUpdate()){
          Right("Done")
        }else{
          Left("DB error")
        }
      case _ => Left("DB error.")
    }
  }

  /*

  SELECT * from RunStepParam INNER JOIN ProtocolStepParam
      ON RunStepParam.param=ProtocolStepParam.id INNER JOIN ProtocolStep
      ON ProtocolStepParam.step=ProtocolStep.id INNER JOIN Experiment
      ON ProtocolStep.experiment=Experiment.id where RunStepParam.step=0 and Experiment.owner=0

   */
  def getParams(runStep: Id)(implicit c: Connection): Array[RunStepParam] = {
    SQL("SELECT * from RunStepParam INNER JOIN ProtocolStepParam "+
      "ON RunStepParam.param=ProtocolStepParam.id INNER JOIN ProtocolStep " +
      "ON ProtocolStepParam.step=ProtocolStep.id INNER JOIN Experiment " +
      s"ON ProtocolStep.experiment=Experiment.id where RunStepParam.step=$runStep and Experiment.owner=$owner")().map{row =>
      RunStepParam(
        id = row[Id]("RunStepParam.id"),
        protocolParam = row[Id]("ProtocolStepParam.id"),
        name = row[String]("ProtocolStepParam.name"),
        value = row[String]("RunStepParam.value"),
        typ = ParamType.read(row[String]("ProtocolStepParam.param_type")).getOrElse(ParamType.Text),
        unit = row[Option[String]]("ProtocolStepParam.unit").getOrElse("")
      )
    }.toArray
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

  implicit val implicitRunStepsWrites = new Writes[Map[(Id,Id),RunStep]] {
    def writes(m: Map[(Id,Id),RunStep]): JsValue = {
      Json.toJson(for((k,v) <- m) yield {
        val kk = k._1.toString + ":" + k._2.toString
        (kk -> v)
      })
    }
  }

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

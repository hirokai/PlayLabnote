package controllers

import play.api._
import play.api.mvc._
import play.api.libs.json._
import play.api.db.DB
import anorm._
import play.api.Play.current

import models._

import models.Database.Id
import play.api.libs.iteratee.{Enumerator, Iteratee}
import scala.concurrent.{Future, ExecutionContext}
import play.libs.Akka
import akka.io.Udp.SO.Broadcast
import java.sql.Connection
import play.cache.Cache
import play.api.libs.ws.WS

object Experiment extends Controller {
  import Database._

  import Util._

  import JsonWriter._

  //$.post('/exps',{name: 'New exp'},function(r){console.log(r);});
  def create() = Action(parse.tolerantFormUrlEncoded) { request =>
    val parameters = request.body
    var o_name: Option[String] = parameters.get("name").flatMap(_.headOption)
    o_name.map{ name =>
      DB.withConnection { implicit c =>
        val u: Option[Id] = Application.getUserId(request)
        val id = ExperimentAccess(u).create(name)
        Ok(Json.obj("id" -> id, "name" -> name))
      }
    }.getOrElse(Status(400))
  }

  def delete(id: Id) = Action {request =>
    DB.withTransaction { implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      val r = ExperimentAccess(u).delete(id)
      Ok(Json.obj("success" -> r.isRight, "id" -> id, "message" -> r.fold(l => l, r => r)))
    }
  }

  def update(id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    var o_name: Option[String] = params.get("name").flatMap(_.headOption)
    o_name.map{ name =>
      val r = DB.withConnection{ implicit c =>
        val u: Option[Id] = Application.getUserId(request)
        ExperimentAccess(u).setName(id,name)
      }
      if(r){
        Ok(Json.obj("success" -> true, "data" -> Json.obj("id" -> id, "name" -> name)))
      }else{
        Ok(Json.obj("success" -> false, "data" -> Json.obj("id" -> id)))
      }
    }.getOrElse(Status(400))
  }

  //$.post('/exps/1/psamples',{name: 'Hige'},function(r){console.log(r);});
  def createProtocolSample(eid: Database.Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    DB.withConnection {implicit c =>
      val parameters = request.body
      val o_name: Option[String] = parameters.get("name").flatMap(_.headOption)
      val o_typ: Option[Id] = parameters.get("type").flatMap(_.headOption).flatMap(toIdOpt)
      (o_name,o_typ) match {
        case (Some(name),Some(typ)) => {
          val u: Option[Id] = Application.getUserId(request)
          val o_id = ProtocolSampleAccess(u).create(eid,name,typ)
          o_id match {
            case Some(id) =>{
              val data: Option[ProtocolSample] = SQL(s"Select * from ProtocolSample where id=$id")().map(ProtocolSample.fromRow(o_owner = u, full=true)).headOption
              Ok(Json.obj("exp_id" -> eid, "id" -> id, "success" -> true, "data" -> data))
            }
            case _ =>
              Ok(Json.obj("exp_id" -> eid, "success" -> false, "message" -> "DB error."))
          }
        }
        case _ =>
          Status(400)
      }
    }
  }

  // $.ajax('/psamples/1',{type: 'put', data: 'name=Huge', success: function(r){console.log(r)}});
  def updateProtocolSample(id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val parameters = request.body
    val o_name: Option[String] = parameters.get("name").flatMap(_.headOption)
    val o_typ: Option[Id] = parameters.get("type").flatMap(_.headOption).flatMap(toIdOpt)
    DB.withTransaction {implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      ProtocolSampleAccess(u).update(id,o_name,o_typ) match {
        case Right(dat) => Ok(Json.obj("id" -> id, "success" -> true, "data" -> dat))
        case Left(err) => Ok(Json.obj("id" -> id, "success" -> false, "message" -> err))
      }
    }
  }

  def deleteProtocolSample(pid: Id) = Action(parse.tolerantFormUrlEncoded) {request =>
    DB.withTransaction {implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      models.ExperimentAccess(u).deleteProtocolSample(pid) match {
        case Right(_) =>    Ok(Json.obj("id" -> pid, "success" -> true))
        case Left(err) => Status(200)(Json.obj("id" -> pid, "success" -> false, "message" -> err))
      }
    }
  }

  def createProtocolStep(id: Id) = Action(parse.tolerantFormUrlEncoded) {request =>
    DB.withTransaction {implicit c =>
      try{
        //Get arrays of input and output. They are string separated by colon.
        val params = request.body
        val o_name: Option[String] = params.get("name").flatMap(_.headOption)
        def collectIds(v: Option[Seq[String]]): Array[Id] = {
          val s: Option[String] = v.flatMap(_.headOption)
          s match {
            case Some(str) => str.split(":").map(toIdOpt).flatten
            case _ => Array()
          }
        }
        val ins: Array[Id] = collectIds(params.get("input"))
        val outs: Array[Id] = collectIds(params.get("output"))

        //Execute DB operation
        o_name match {
          case Some(name) => {
            val u: Option[Id] = Application.getUserId(request)
            val r = ExperimentAccess(u).createProtocolStep(id,name,ins,outs)
            r match {
              case Right(step_id) =>{
                val ps = ProtocolStepAccess(u).get(step_id)
                Ok(Json.obj("exp_id" -> id, "id" -> step_id, "data" -> ps))
              }
              case Left(err) =>{
                c.rollback()
                Status(500)(Json.obj("message" -> err))
              }
            }
          }
          case _ =>{
            c.rollback()
            Status(500)(Json.obj("message" -> "Missing name."))
          }
        }
      }catch{
        case e: Throwable => c.rollback()
        throw e
        Status(500)(Json.obj("success" -> false, "message" -> e.getMessage))
      }
    }
  }

  def createProtocolStepParam(step: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    import ParamType._
    val params = request.body
    val o_name = params.get("name").flatMap(_.headOption)
    val o_typ = params.get("type").flatMap(_.headOption)
    val o_unit = params.get("unit").flatMap(_.headOption)
    o_name match {
      case Some(name) =>
        val typ = o_typ.flatMap(read).getOrElse(Text)
        val unit = o_unit.getOrElse("")
        DB.withConnection { implicit c =>
          val u: Option[Id] = Application.getUserId(request)
          ProtocolStepAccess(u).createParam(step,name,typ,unit).fold(
            l => Status(400)(l),
            r => {
              val d = ProtocolStepAccess(u).getParam(r)
              Ok(Json.obj("id" -> r, "data" -> d))
            }
          )
        }
      case _ => Status(400)("Param is missing.")
    }
  }

  def updateProtocolStepParam(param_id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    import ParamType._
    val params = request.body
    val o_name: Option[String] = params.get("name").flatMap(_.headOption)
    val o_typ: Option[ParamType] = params.get("type").flatMap(_.headOption).flatMap(read)
    val o_unit: Option[String] = params.get("unit").flatMap(_.headOption)
    DB.withConnection {implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      ProtocolStepAccess(u).updateParam(param_id,o_name,o_typ,o_unit).fold(
      l => Status(400)(l),
      r => Ok(Json.obj("id" -> param_id, "data" -> r))
      )
    }
  }

  def deleteProtocolStepParam(id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    val force = params.get("force").flatMap(_.headOption) == Some("true")
    DB.withConnection { implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      ProtocolStepAccess(u).deleteParam(id,force).fold(
      l => Status(400)(l),
      r => Ok(Json.obj("id" -> id))
      )
    }
  }

  def getProtocolStep(id: Id) = Action {request =>
    DB.withConnection {implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      val r = ProtocolStepAccess(u).get(id)
      r match {
        case Some(dat) => Ok(Json.toJson(dat))
        case _ => NotFound(Json.obj("id" -> id))
      }
    }
  }

  //ToDo: Add params updates.
  def updateProtocolStep(id: Id) = Action(parse.tolerantFormUrlEncoded) {request =>
    DB.withTransaction {implicit c =>
      try{
        //Get arrays of input and output. They are string separated by colon.
        val params = request.body
        val o_name: Option[String] = params.get("name").flatMap(_.headOption)
        def collectIds(v: Seq[String]): Option[Array[Id]] = {
          val s: Option[String] = v.headOption
          s match {
            case Some(str) => Some(str.split(":").map(toIdOpt).flatten)
            case _ => None
          }
        }
        val ins: Option[Array[Id]] = params.get("input").flatMap(collectIds)
        val outs: Option[Array[Id]] = params.get("output").flatMap(collectIds)

        //Execute DB operation
        val u: Option[Id] = Application.getUserId(request)
        val r = ExperimentAccess(u).updateProtocolStep(id,o_name,ins,outs)
        r match {
          case Right(step_id) =>{
            val ps = ProtocolStepAccess(u).get(step_id)
            Ok(Json.obj("exp_id" -> id, "id" -> step_id, "data" -> ps))
          }
          case Left(err) =>{
            c.rollback()
            Status(400)(Json.obj("message" -> err))
          }
        }
      }catch{
        case e: Throwable => c.rollback()
          throw e
          Status(400)(Json.obj("success" -> false, "message" -> e.getMessage))
      }
    }
  }

  def deleteProtocolStep(id: Id) = Action {request =>
    DB.withConnection {implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      ProtocolStepAccess(u).delete(id).fold (
        l => {
          Status(400)(l)
        },
        r => {
          Ok("")
        }
      )
    }
  }

  def getExpRuns(id: Id) = Action {
    DB.withConnection {implicit c =>
      val newData = SQL(s"Select * from ExpRun where experiment={e} order by id").on('e -> id)().map( row => {
        ExpRun(
          name = row[Option[String]]("name").getOrElse("(N/A)"),
          id = row[Long]("id")
        )
      })
      Ok(Json.obj("success" -> true, "data" -> newData))
    }
  }

  def getExpRun(id: models.Database.Id) = Action {Ok("stub")}

  def deleteExpRun(id: Id) = Action {
    DB.withConnection {implicit c =>
      try {
        SQL(s"DELETE from ExpRun where id=$id").execute()
        Ok(Json.obj("success" -> true))
      }catch {
        case e: Throwable => Status(400)("Run not deleted: "+e.getMessage)
      }
    }
  }

  def createExpRun(eid: models.Database.Id) = Action(parse.tolerantFormUrlEncoded) {request =>
    DB.withConnection {implicit c =>
      val params = request.body
      var o_name = params.get("name").flatMap(_.headOption)
      o_name.map{ name =>
        val u: Option[Id] = Application.getUserId(request)
        val o_id = ExpRunAccess(u).create(eid,name)
        o_id match {
          case Some(id) => {
            val data = SQL(s"Select * from ExpRun where id=$id")().map(ExpRun.fromRow).headOption
            Ok(Json.obj("exp_id" -> eid, "id" -> id, "success" -> true, "data" -> data))
          }
          case _ => {
            Ok(Json.obj("exp_id" -> eid, "success" -> false, "message" -> "DB error."))
          }
        }
      }.getOrElse(Status(400))
    }
  }

  def createRunSample(rid: Id, pid: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    val creating = params.get("create").flatMap(_.headOption) == Some("true")
    //Sample ID to assign.
    val o_id = params.get("id").flatMap(_.headOption).flatMap(toIdOpt)
    val o_name = params.get("name").flatMap(_.headOption)
    val tid = params.get("type").flatMap(_.headOption).flatMap(toIdOpt)
    if(creating){
      o_name match {
        case Some(n) => {
          DB.withTransaction {implicit c =>
            val u: Option[Id] = Application.getUserId(request)
            val o_r: Option[Id] = ExperimentAccess(u).createRunSample(rid,pid,n,tid)
            o_r match {
              case Some(r) => {
                val o_typ = SampleAccess(u).get(r).map{ sample =>
                  sample.typ match {
                    case Right(t) => Some(t)
                    case _ => None
                  }
                }
                (o_r,o_typ)
              }
              case _ => (o_r, None)
            }
          } match {
            case (Some(id),Some(typ)) =>
              Ok(Json.obj("success" -> true, "id" -> id,
                "data" -> Json.obj("id" -> id, "name" -> n, "run" -> rid, "protocolSample" -> pid, "typ" -> typ)))
            case _ =>
              NotFound(Json.obj())
          }
        }
        case _ => Status(400)
      }
    }else{
      o_id match {
        case Some(id) =>
          DB.withTransaction {implicit c =>
            val u: Option[Id] = Application.getUserId(request)
            if(ExperimentAccess(u).assignExistingSample(rid,pid,id)){
              Ok(Json.obj("success"-> true))
            }else{
              Status(400)("DB error in assignment.")
            }
          }
        case _ => Status(400)("Param is missing.")
      }
    }

  }

  def getRunSamples(id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    val input = params.get("input").flatMap(_.headOption) == Some("true")
    val output = params.get("output").flatMap(_.headOption) == Some("true")
    DB.withConnection{implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      val ins = ExperimentAccess(u).getRunSamples(id)  //Stub
      val outs = ExperimentAccess(u).getRunSamples(id)  //Stub
      Ok(Json.obj("success" -> true, "input" -> ins, "output" -> outs))
    }
  }

  def deleteRunSample(rid: Id, pid: Id) = Action(parse.tolerantFormUrlEncoded) {request =>
      DB.withTransaction { implicit c =>
        val u: Option[Id] = Application.getUserId(request)
        if(ExperimentAccess(u).deleteRunSample(rid,pid)){
          Ok(Json.obj("success" -> true))
        }else{
          Ok(Json.obj("success" -> false))
        }
      }
  }

  def createRunStep(run: Id) = Action(parse.tolerantFormUrlEncoded) {request =>
    val params = request.body
    val o_pstep: Option[Id] = params.get("pstep").flatMap(_.headOption).flatMap(toIdOpt)
    val o_time_at: Option[Id] = params.get("time").flatMap(_.headOption).flatMap(toLongOpt)
    o_pstep match {
      case Some(pstep) => {
        DB.withTransaction { implicit c =>
          val u: Option[Id] = Application.getUserId(request)
          ExpRunAccess(u).createRunStep(run,pstep,o_time_at) match {
            case Right(id) => {
              Ok(Json.obj("success" -> true, "id" -> id, "data" -> RunStepAccess(u).get(id)))
            }
            case Left(err) => Status(400)(Json.obj("success" -> false, "message" -> err))
          }
        }
      }
      case _ => Status(400)("Param 'pstep' missing.")
    }
  }

  def updateRunStep(rsid: Id) = Action(parse.tolerantFormUrlEncoded) {request =>
    val params = request.body
    val o_note: Option[String] = params.get("note").flatMap(_.headOption)
    o_note match {
      case Some(note) =>
        DB.withConnection {implicit c =>
          val u: Option[Id] = Application.getUserId(request)
          RunStepAccess(u).updateNote(rsid,note).fold(
            l => Status(400)(l),
            r => {
              val dat = RunStepAccess(u).get(rsid)
              Ok(Json.obj("id" -> rsid, "data" -> dat))
            }
          )
        }
      case _ => Status(400)("Param missing.")
    }
  }

  def deleteRunStep(step: Id) = Action {request =>
    DB.withTransaction {implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      RunStepAccess(u).delete(step).fold(
        l => Status(400)(l),
        r => Ok(Json.obj("id" -> step))
      )
    }
  }

  def createRunStepParam(pid: Id, rid: Id) = Action(parse.tolerantFormUrlEncoded) {request =>
    val params = request.body
    val o_value: Option[String] = params.get("value").flatMap(_.headOption)
    o_value match {
      case Some(value) =>
        DB.withConnection {implicit c =>
          Logger.debug("%d %d %s\n".format(rid,pid,value))
          val u: Option[Id] = Application.getUserId(request)
          RunStepAccess(u).createParam(rid,pid,value).fold(
            l => Status(400)(l),
            r => Ok(Json.obj("id" -> r))
          )
        }
      case _ => Status(400)("Param not found.")
    }
  }

  def updateRunStepParam(pid: Id, rid: Id) = Action(parse.tolerantFormUrlEncoded) {request =>
    val params = request.body
    val o_value: Option[String] = params.get("value").flatMap(_.headOption)
    o_value match {
      case Some(value) =>
        DB.withConnection {implicit c =>
          val u: Option[Id] = Application.getUserId(request)
          RunStepAccess(u).updateParam(rid,pid,value).fold(
            l => Status(400)(l),
            r => Ok(Json.obj("data" -> Json.obj("protocolParam" -> pid, "value" -> value)))
          )
        }
      case _ => Status(400)("Param not found.")
    }
  }


  def stub(id: Id) = Action {
    Ok("Stub")
  }

  def exportToGDrive(id: Id) = Action.async {request =>
    import scala.concurrent.ExecutionContext.Implicits.global
    DB.withConnection{implicit c =>
      val user: Option[(Id,String)] = Application.getUserIdAndAccessToken(request)
      user match {
        case Some((uid, accessToken)) =>{
          val u: Option[Id] = Some(uid)
          val exp = ExperimentAccess(u).getFull(id).get
          val title = "Labnotebook: Experiment: " + exp.name

          ExportGSheet.export(accessToken, getGSheetId(id), title, exp.mkSpreadSheet).map{r =>
            DB.withConnection{implicit c =>
              r._1.map({
                  setGSheetId(id,_)
              })
              incrementGSheetSaveCount(id)
            }
            val json = Json.obj("response" -> r._3, "updated_access_token" -> r._2)
            Ok(json)
          }
        }
        case _ => Future(Status(400))
      }
    }
  }

  def setGSheetId(id: Id, sheet_id: String)(implicit c: Connection): Boolean = {
    if(getGSheetId(id).isDefined){
      SQL(s"UPDATE GDriveExportExp SET sheet_id='${escape(sheet_id)}' where experiment=$id").executeUpdate() == 1
    }else{
      SQL(s"INSERT into GDriveExportExp(experiment,sheet_id,save_count) values($id,'${escape(sheet_id)}',0)").executeInsert()
      true
    }
  }

  def incrementGSheetSaveCount(id: Id)(implicit c: Connection): Option[Int] = {
    SQL(s"UPDATE GDriveExportExp SET save_count=save_count+1 where experiment=$id").executeUpdate()
    SQL(s"SELECT save_count from GDriveExportExp where experiment=$id")().map(_[Int]("save_count")).headOption
  }

  def getGSheetId(id: Id): Option[String] = {
    DB.withConnection{implicit c  =>
      SQL(s"SELECT sheet_id from GDriveExportExp where experiment=$id")().map(_[String]("sheet_id")).headOption
    }
  }

  def listJson = Action { request =>
    DB.withConnection {implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      println(u)
      Ok(Json.toJson(ExperimentAccess(u).list(full = false)))
    }
  }

  def getJson(id: Id) = Action { request =>

    val full = request.getQueryString("full") == Some("true")
    DB.withConnection {implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      val exp: Option[models.Experiment] =
        if(full) ExperimentAccess(u).getFull(id) else ExperimentAccess(u).get(id)
       exp match {
         case Some(e) => Ok(Json.toJson(e))
         case _ => NotFound(Json.obj())
       }
    }
  }

  // $.post('/test/test',function(r){console.log(r);});
  def addTestData(name: String) = Action { request =>
    name match {
      case "test" => {
        new models.SampleDatabase(Some(0l)).setup()
        Ok(Json.obj("success" -> true))
      }
      case "add_types" => {
        DB.withConnection {implicit c =>
          val u: Option[Id] = Application.getUserId(request)
          val any = models.SampleType.getAnyTypeId(u)
          val t1 = SampleTypeAccess(u).create("SUVs",any).get
          val t2 = SampleTypeAccess(u).create("Fab materials",any).get
          val t3 = SampleTypeAccess(u).create("Substrate",any).get
          val t4 = SampleTypeAccess(u).create("Lipid",any).get
          val t5 = SampleTypeAccess(u).create("Protein",any).get
          val t6 = SampleTypeAccess(u).create("Cells",any).get
          val t7 = SampleTypeAccess(u).create("Glass coverslip",t3).get
          val t8 = SampleTypeAccess(u).create("Phoenix cells",t6).get
          val t9 = SampleTypeAccess(u).create("DOPC 100% SUVs",t1).get
          val t10 = SampleTypeAccess(u).create("Photoresist",t2).get
        }
        Ok(Json.obj("success" -> true))
      }
    }
  }

  import scala.concurrent.duration._
  import akka.actor._
  import scala.concurrent.ExecutionContext.Implicits.global

  def socket(id: Id) = WebSocket.acceptWithActor[String, String] { request => out =>
      val props: Props = MyWebSocketActor.props(id, out)

      props
    }

  object MyWebSocketActor {
    def props(id: Id, out: ActorRef) = Props(new MyWebSocketActor(id, out))
  }

  class MyWebSocketActor(id: Id, out: ActorRef) extends Actor {
    val sche = Akka.system.scheduler.schedule(0 seconds, 5 seconds) {
      Logger.debug("Timer for: "+id.toString)
      out ! ("Timer invoked: "+id.toString)
    }
    override def postStop() = {
      sche.cancel()
      Logger.debug("Websocket closed.")
    }
    def receive = {
      case msg: String =>
        out ! ("I received your message: " + id.toString + " " + msg)
    }
  }
}

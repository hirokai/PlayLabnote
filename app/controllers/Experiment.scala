package controllers

import play.api._
import play.api.mvc._
import play.api.libs.json._
import play.api.db.DB
import anorm._
import play.api.Play.current

import models._

import models.Database.Id

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
        val id = ExperimentAccess().create(name)
        Ok(Json.obj("id" -> id, "name" -> name))
      }
    }.getOrElse(Status(400))
  }

  def delete(id: Id) = Action {
    DB.withTransaction { implicit c =>
      val r = ExperimentAccess().delete(id)
      Ok(Json.obj("success" -> r, "id" -> id))
    }
  }

  def update(id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    var o_name: Option[String] = params.get("name").flatMap(_.headOption)
    o_name.map{ name =>
      val r = DB.withConnection{ implicit c =>
        ExperimentAccess().setName(id,name)
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
          val o_id = ProtocolSampleAccess().create(eid,name,typ)
          o_id match {
            case Some(id) =>{
              val data: Option[ProtocolSample] = SQL(s"Select * from ProtocolSample where id=$id")().map(ProtocolSample.fromRow(full=true)).headOption
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
      ProtocolSampleAccess().update(id,o_name,o_typ) match {
        case Right(dat) => Ok(Json.obj("id" -> id, "success" -> true, "data" -> dat))
        case Left(err) => Ok(Json.obj("id" -> id, "success" -> false, "message" -> err))
      }
    }
  }

  def deleteProtocolSample(pid: Id) = Action(parse.tolerantFormUrlEncoded) {request =>
    DB.withTransaction {implicit c =>
      models.ExperimentAccess().deleteProtocolSample(pid) match {
        case Right(_) =>    Ok(Json.obj("id" -> pid, "success" -> true))
        case Left(err) => Ok(Json.obj("id" -> pid, "success" -> false, "message" -> err))
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
            val r = ExperimentAccess().createProtocolStep(id,name,ins,outs)
            r match {
              case Right(step_id) =>
                Ok(Json.obj("exp_id" -> id, "id" -> step_id))
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

  def getProtocolStep(id: Id) = Action {
    DB.withConnection {implicit c =>
      val r = ProtocolStepAccess().get(id)
      r match {
        case Some(dat) => Ok(Json.toJson(dat))
        case _ => NotFound(Json.obj("id" -> id))
      }
    }
  }

  def updateProtocolStep(id: Id) = Action {
    Status(500)("Stub")
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
      SQL(s"DELETE from ExpRun where id=$id").execute()
      Ok(Json.obj("success" -> true))
    }
  }

  def createExpRun(eid: models.Database.Id) = Action(parse.tolerantFormUrlEncoded) {request =>
    DB.withConnection {implicit c =>
      val params = request.body
      var o_name = params.get("name").flatMap(_.headOption)
      o_name.map{ name =>
        val o_id = ExpRunAccess().create(eid,name)
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
    val o_name = params.get("name").flatMap(_.headOption)
    val tid = params.get("type").flatMap(_.headOption).flatMap(toIdOpt)
    o_name match {
      case Some(n) => {
        DB.withTransaction {implicit c =>
          val o_r: Option[Id] = ExperimentAccess().createRunSample(rid,pid,n,tid)
          o_r match {
            case Some(r) => {
              val o_typ = SampleAccess().get(r).map{ sample =>
                sample.typ match {
                  case Right(t) => Some(t)
                  case _ => None
                }
              }
              (o_r,o_typ)
            }
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
  }

  def getRunSamples(id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    val input = params.get("input").flatMap(_.headOption) == Some("true")
    val output = params.get("output").flatMap(_.headOption) == Some("true")
    DB.withConnection{implicit c =>
      val ins = ExperimentAccess().getRunSamples(id)  //Stub
      val outs = ExperimentAccess().getRunSamples(id)  //Stub
      Ok(Json.obj("success" -> true, "input" -> ins, "output" -> outs))
    }
  }

  def deleteRunSample(rid: Id, pid: Id) = Action(parse.tolerantFormUrlEncoded) {request =>
      DB.withTransaction { implicit c =>
        if(ExperimentAccess().deleteRunSample(rid,pid)){
          Ok(Json.obj("success" -> true))
        }else{
          Ok(Json.obj("success" -> false))
        }
      }
  }

  def stub(id: Id) = Action {
    Ok("Stub")
  }

  def listJson = Action {
    DB.withConnection {implicit c =>
      val exps: Stream[models.Experiment] =
        SQL(s"Select * from Experiment order by id")().map( row => {
          models.Experiment(
            id = row[Long]("id"),
            name = row[Option[String]]("name").getOrElse("(N/A)"),
            owner =  row[Database.Id]("owner")
          )
        })
      Ok(Json.toJson(exps))
    }
  }

  def getJson(id: Id) = Action { request =>
    val full = request.getQueryString("full") == Some("true")
    DB.withConnection {implicit c =>
      val exp: Option[models.Experiment] =
        if(full) ExperimentAccess().getFull(id) else ExperimentAccess().get(id)
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
        new models.SampleDatabase(0).setup()
        Ok(Json.obj("success" -> true))
      }
      case "add_types" => {
        DB.withConnection {implicit c =>
          val any = models.SampleType.AnyType.id
          val t1 = SampleTypeAccess().create("SUVs",any).get
          val t2 = SampleTypeAccess().create("Fab materials",any).get
          val t3 = SampleTypeAccess().create("Substrate",any).get
          val t4 = SampleTypeAccess().create("Lipid",any).get
          val t5 = SampleTypeAccess().create("Protein",any).get
          val t6 = SampleTypeAccess().create("Cells",any).get
          val t7 = SampleTypeAccess().create("Glass coverslip",t3).get
          val t8 = SampleTypeAccess().create("Phoenix cells",t6).get
          val t9 = SampleTypeAccess().create("DOPC 100% SUVs",t1).get
          val t10 = SampleTypeAccess().create("Photoresist",t2).get
        }
        Ok(Json.obj("success" -> true))
      }
    }
  }
}

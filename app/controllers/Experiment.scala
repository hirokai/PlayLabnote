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
  import Database.Id

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
      var o_name: Option[String] = parameters.get("name").flatMap(_.headOption)
      o_name.map{ name =>
        val id = ProtocolSampleAccess().create(eid,name,models.SampleType.AnyType.id)
        val newData = SQL(s"Select * from ProtocolSample order by id")().map( row => {
          ProtocolSample(
            name = row[Option[String]]("name").getOrElse("(N/A)"),
            id = row[Long]("id")
          )
        })
        Ok(Json.obj("exp_id" -> eid, "id" -> id, "success" -> true, "newData" -> newData))
      }.getOrElse(Status(400))
    }
  }

  // $.ajax('/psamples/1',{type: 'put', data: 'name=Huge', success: function(r){console.log(r)}});
  def updateProtocolSample(id: String) = Action(parse.tolerantFormUrlEncoded) { request =>
    val parameters = request.body
    var o_name: Option[String] = parameters.get("name").flatMap(_.headOption)
    o_name.map{ name =>
      DB.withTransaction {implicit c =>
        models.ProtocolSampleAccess().setName(id.toLong,name)
      }
      Ok(Json.obj("id" -> id, "success" -> true))
    }.getOrElse(Status(400))
  }

  def getExpRuns(id: String) = Action {
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
  def deleteExpRun(id: String) = Action {
    DB.withConnection {implicit c =>
      SQL("DELETE from ExpRun where id={id}").on('id -> id).execute()
      Ok(Json.obj("success" -> true))
    }
  }

  def createExpRun(eid: models.Database.Id) = Action {request =>
    DB.withConnection {implicit c =>
      val parameters = request.body.asFormUrlEncoded
      var name = parameters.get("name")(0)
      val id = ExpRunAccess().create(eid,name)
      val newData = SQL(s"Select * from ExpRun order by id")().map( row => {
        ExpRun(
          name = row[Option[String]]("name").getOrElse("(N/A)"),
          id = row[Long]("id")
        )
      })
      Ok(Json.obj("exp_id" -> eid, "id" -> id, "success" -> true, "newData" -> newData))
    }
  }

  def createRunSample(rid: Id, pid: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    val o_name = params.get("name").flatMap(_.headOption)
    val tid = params.get("type").flatMap(_.headOption).map(_.toLong)
    o_name match {
      case Some(n) => {
        DB.withConnection {implicit c =>
          val o_r: Option[Id] = ExperimentAccess().createRunSample(rid,pid,n,tid)
          val Right(typ) = SampleAccess().get(o_r.get).get.typ
          (o_r,typ)
        } match {
          case (Some(id),typ) =>
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

  def stub(id: String) = Action {
    Ok("Stub")
  }

  def list = Action {
    Ok(views.html.experiment_list())
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

  def get(id: Id) = Action { request =>
    DB.withConnection { implicit c =>
      ExperimentAccess().getFull(id.toLong).map{ exp =>
        Ok(views.html.experiment(id,Json.toJson(exp)))
      }.getOrElse(NotFound(views.html.notFound()))
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

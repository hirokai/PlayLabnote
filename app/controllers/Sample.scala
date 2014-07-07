package controllers

import models.Database._
import models.{Sample, SampleTypeAccess, SampleAccess, JsonWriter}
import play.api.db.DB
import play.api.libs.json.Json
import play.api.mvc.BodyParsers.parse
import play.api.mvc.{Action, Controller}
import scala.Some
import play.api.Play.current
import play.Logger

object Sample extends Controller {
  import JsonWriter.implicitSampleTypeWrites
  import JsonWriter.implicitSampleWrites

  import Util._

  def stub(id: Id) = Action {
    Ok("Stub")
  }

  def create = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    var o_typ: Option[Id] = params.get("type").flatMap(_.headOption).flatMap(toIdOpt)
    var o_name: Option[String] = params.get("name").flatMap(_.headOption)
    (o_name,o_typ) match {
      case (Some(name),Some(tid)) =>{
        DB.withConnection{ implicit c =>
          val u: Option[Id] = Application.getUserId(request)
          SampleAccess(u).create(name,tid) match {
            case Some(id) => {
              val typ = SampleTypeAccess(u).get(tid)
              Ok(Json.obj("success" -> true, "data" -> Json.obj("id" -> id, "name" -> name, "typ" -> typ)))
            }
            case _ => Ok(Json.obj("success" -> false))
          }
        }
      }
      case _ => Ok(Json.obj("success" -> false, "message" -> "Params missing."))
    }
  }

  def delete(id: Id) = Action { request =>
    val force = request.getQueryString("force") == Some("true")
    DB.withConnection{ implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      val r = SampleAccess(u).delete(id,force)
      Ok(Json.obj("success" -> r, "data" -> Json.obj("id" -> id)))
    }
  }

  def listJson = Action { request =>
    DB.withConnection{ implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      val samples = SampleAccess(u).list
      Ok(Json.toJson(samples))
    }
  }

  def getJson(id: Id) = Action { request =>
    DB.withConnection{ implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      val sample = SampleAccess(u).get(id)
      Ok(Json.toJson(sample))
    }
  }

  def getExps(id: Id) = Action {request =>
    import JsonWriter.implicitExperimentWrites
    DB.withConnection{implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      val exps: Array[models.Experiment] = SampleAccess(u).findExps(id)
      Ok(Json.obj("success" -> true, "data" -> exps))
    }
  }

  // $.get('/samples/of_type/0',{subtypes: true}, function(r){console.log(r)});
  def samplesOfType(tid: Id) = Action { request =>
    val subtypes = request.getQueryString("subtypes") == Some("true")
    val countOnly = request.getQueryString("countOnly") == Some("true")
    DB.withConnection {implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      if(countOnly){
        val count = SampleAccess(u).findCompatibleSampleCount(tid,subtypes)
        Ok(Json.obj("count" -> count))
      }else{
        Logger.debug("%d %b".format(tid,subtypes))
        val samples = SampleAccess(u).findCompatibleSamples(tid,subtypes).toArray
        Ok(Json.toJson(samples))
      }
    }
  }

  def samplesOfTypes = Action { request =>
    val tids: Array[Id] = request.getQueryString("types").map(_.split(",").map(toIdOpt(_).get)).getOrElse(Array()).distinct
    val subtypes = request.getQueryString("subtypes") == Some("true")
    val countOnly = request.getQueryString("countOnly") == Some("true")
    DB.withConnection {implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      if(countOnly){
        val count: Long = tids.map(tid => SampleAccess(u).findCompatibleSampleCount(tid,subtypes)).sum
        Ok(Json.obj("count" -> count))
      }else{
//        Logger.debug("%d %b".format(tid,subtypes))
        val samples: Array[models.Sample] = tids.map(tid => SampleAccess(u).findCompatibleSamples(tid,subtypes).toArray).flatten
        Ok(Json.toJson(samples))
      }
    }
  }

  def update(id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val parameters = request.body
    var o_typ: Option[Id] = parameters.get("type").flatMap(_.headOption).flatMap(toIdOpt)
    var o_name: Option[String] = parameters.get("name").flatMap(_.headOption)
    val res = DB.withConnection{ implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      if(o_typ.isEmpty || SampleAccess(u).isTypeCompatibleWithAllAssignment(id,o_typ.get)){
        if(SampleAccess(u).update(id,o_name,o_typ)){
          Some(Json.obj("id" -> id, "name" -> o_name, "typ" -> o_typ))
        }else{
          None
        }
      }else{
        None
      }
    }
    res match {
      case Some(s) =>
        Ok(Json.obj("success" -> true, "data" -> s))
      case _ =>
        Ok(Json.obj("success" -> false))
    }
  }

  def createData(id: Id)  = Action(parse.tolerantFormUrlEncoded) { request =>
    import JsonWriter.implicitSampleDataWrites
    val parameters = request.body
    var o_name: Option[String] = parameters.get("name").flatMap(_.headOption)
    var o_url: Option[String] = parameters.get("url").flatMap(_.headOption)
    var o_icon: Option[String] = parameters.get("icon").flatMap(_.headOption)
    var o_note: Option[String] = parameters.get("note").flatMap(_.headOption)
    var o_original_id: Option[String] = parameters.get("original_id").flatMap(_.headOption)
    (o_url,o_name) match {
      case (Some(url),Some(name)) => {
        DB.withConnection{ implicit c =>
          val u: Option[Id] = Application.getUserId(request)
          SampleAccess(u).addData(id,url,name,"gdrive",o_icon,o_note,o_original_id) match {
            case Some(r) =>
              val d = SampleAccess(u).getData(r)
              d match {
                case Some(dat) =>
                  Ok(Json.obj("success" -> true, "id" -> r, "data" -> dat))
                case _ =>
                  Status(400)
              }
            case _ =>
              Status(400)
          }
        }
      }
      case _ =>
        Status(400)
    }
  }

  def deleteData(id: Id) = Action {request =>
    DB.withConnection{ implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      if(SampleAccess(u).deleteData(id)){
        Ok("Done.")
      }else{
        Status(400)
      }
    }
  }

}

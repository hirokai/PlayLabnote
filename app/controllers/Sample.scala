package controllers

import models.Database._
import models.{SampleTypeAccess, SampleAccess, JsonWriter}
import play.api.db.DB
import play.api.libs.json.Json
import play.api.mvc.BodyParsers.parse
import play.api.mvc.{Action, Controller}
import scala.Some
import play.api.Play.current

object Sample extends Controller {
  import JsonWriter.implicitSampleTypeWrites
  import JsonWriter.implicitSampleWrites

  def stub(id: String) = Action {
    Ok("Stub")
  }

  def list = Action {
    DB.withConnection{ implicit c =>
      val samples = SampleAccess().list
      println(samples.length)
      Ok(views.html.sample_list(None,Json.toJson(samples)))
    }
  }

  def create = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    var o_typ: Option[Id] = params.get("type").flatMap(_.headOption).map(_.toLong)
    var o_name: Option[String] = params.get("name").flatMap(_.headOption)
    (o_name,o_typ) match {
      case (Some(name),Some(tid)) =>{
        DB.withConnection{ implicit c =>
          SampleAccess().create(name,tid) match {
            case Some(id) => {
              val typ = SampleTypeAccess().get(tid)
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
      val r = SampleAccess().delete(id,force)
      Ok(Json.obj("success" -> r))
    }
  }

  def listJson = Action {
    DB.withConnection{ implicit c =>
      val samples = SampleAccess().list
      Ok(Json.toJson(samples))
    }
  }

  def get(id: Id) = Action {
    DB.withConnection{ implicit c =>
      val sample = SampleAccess().get(id)
      Ok(views.html.sample(id, Json.toJson(sample)))
    }
  }

  def getJson(id: Id) = Action {
    DB.withConnection{ implicit c =>
      val sample = SampleAccess().get(id)
      Ok(Json.toJson(sample))
    }
  }

  // $.get('/samples/of_type/0',{subtypes: true}, function(r){console.log(r)});
  def samplesOfType(tid: Id) = Action { request =>
    val subtypes = request.getQueryString("subtypes") == Some("true")
    val countOnly = request.getQueryString("countOnly") == Some("true")
    if(countOnly){
      val count = SampleAccess().findCompatibleSampleCount(tid,subtypes)
      Ok(Json.obj("count" -> count))
    }else{
      val samples = SampleAccess().findCompatibleSamples(tid,subtypes).toArray
      Ok(Json.toJson(samples))
    }
  }

  def update(id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val parameters = request.body
    var o_typ: Option[Id] = parameters.get("type").flatMap(_.headOption).map(_.toLong)
    var o_name: Option[String] = parameters.get("name").flatMap(_.headOption)
    val res = DB.withConnection{ implicit c =>
      if(o_typ.isEmpty || SampleAccess().isTypeCompatibleWithAllAssignment(id,o_typ.get)){
        if(SampleAccess().update(id,o_name,o_typ)){
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

}

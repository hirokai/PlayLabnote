package controllers

import models.Database._
import models.{SampleTypeAccess, SampleType, JsonWriter}
import play.api.db.DB
import play.api.libs.json.Json
import play.api.mvc.{Action, Controller}
import scala.Array
import scala.Some
import play.api.Play.current
import play.Logger

object SampleType extends Controller {
  import JsonWriter.mkTreeJson
  import JsonWriter.implicitSampleTypeWrites
  import JsonWriter.implicitSampleWrites
  import models.Tree

  def create = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    val o_name = params.get("name").flatMap(_.headOption)
    val o_parent = params.get("parent").flatMap(_.headOption).map(_.toLong)  //FIXME: Unsafe conversion!
    (o_name,o_parent) match {
      case (Some(name),Some(parent)) =>
      DB.withConnection{implicit c =>
        val res = SampleTypeAccess().create(name,parent)
        res.map{ id =>
          Ok(Json.obj("success" -> true, "data" -> Json.obj("id" -> id, "name" -> name, "parent" -> parent)))
        }.getOrElse(Ok(Json.obj("success" -> false, "message" -> "DB failed.")))
      }
      case _ =>{
        Logger.debug("SampelType.create(): Bad request.")
        Status(400)
      }
    }
  }

  def update(id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    val params = request.body
    //Logger.debug(params.mkString)
    val o_name = params.get("name").flatMap(_.headOption)
    val o_parent = params.get("parent").flatMap(_.headOption).map(_.toLong)  //FIXME: Unsafe conversion!
    DB.withConnection{implicit c =>
      val res = SampleTypeAccess().update(id,o_name,o_parent)
      res match {
        case Right(_) => Ok(Json.obj("success" -> true, "data" -> Json.obj("id" -> id, "name" -> o_name, "parent" -> o_parent)))
        case Left(err) =>
          Ok(Json.obj("success" -> false, "message" -> err))
      }
    }
  }

  def delete(id: Id) = Action(parse.tolerantFormUrlEncoded) { request =>
    DB.withTransaction {implicit c =>
//      val params = request.body
//      val force = params.get("force").flatMap(_.headOption) == Some("true")
      if(!SampleTypeAccess().hasSamples(id, subtypes = true)){
        val r = SampleTypeAccess().delete(id,subtypes=true)
        if(r) Ok(Json.obj("success" -> true, "id" -> id)) else Ok(Json.obj("success" -> false, "id" -> id))
      }else{
        Ok(Json.obj("success" -> false, "id" -> id, "message" -> "Has samples"))
      }
    }
  }


  def listJson() = Action { request =>
    val flatten: Boolean = request.getQueryString("flatten") == Some("true")
    DB.withConnection{ implicit c =>
      if(flatten){
        val arr: Array[SampleType] = Array(SampleTypeAccess().get(models.SampleType.AnyType.id).get) ++
          SampleTypeAccess().findDescendants()(models.SampleType.AnyType)
        Ok(Json.toJson(arr))
      }else{
        val tree: Tree[SampleType] = SampleTypeAccess().getTypeTree()(models.SampleType.AnyType)
        Ok(mkTreeJson(tree))
      }
    }
  }

  def list() = Action {
    DB.withConnection{ implicit c =>
      val tree: Tree[SampleType] = SampleTypeAccess().getTypeTree()(models.SampleType.AnyType)
      Ok(views.html.types(None, mkTreeJson(tree)))
    }
  }

  def get(id: Id) = Action {
    DB.withConnection{ implicit c =>
//      val t = SampleTypeAccess().get(id)
      val tree: Tree[SampleType] = SampleTypeAccess().getTypeTree()(models.SampleType.AnyType)
      Ok(views.html.types(Some(id),mkTreeJson(tree)))
    }
  }

  def getJson(id: Id) = Action {request =>
    DB.withConnection{ implicit c =>
      val full = request.getQueryString("full") == Some("true")
      val o_t = SampleTypeAccess().get(id)
       o_t match {
         case Some(t) =>
           if(full){
             val samples = models.SampleAccess().findCompatibleSamples(id,true)
             Ok(Json.obj("id"->id, "name" -> t.name, "samples" -> samples))
           }else{
             Ok(Json.toJson(t))
           }
         case None =>
           NotFound(Json.obj("success" -> false))
       }
    }
  }

  def getDirectSubtypes(id: Id) = Action {request =>
  // Whether this returns the type detail or not.
    val deep: Option[String] = request.getQueryString("deep")
    DB.withConnection{ implicit c =>
      if(deep == Some("true")){
        val t = SampleTypeAccess().get(id)
        Ok(Json.toJson(t.map(SampleTypeAccess().findChildren)))
      }
      else
        Ok(Json.toJson(SampleTypeAccess().findChildrenId(id)))
    }
  }

  // $.get('/types/0/subtypes',{full: true}, function(r){console.log(r);});
  def getSubtypes(id: Id) = Action {request =>
  // Whether this returns the type detail or not.
    val full = request.getQueryString("full") == Some("true")
    DB.withConnection{ implicit c =>
      if(full){
        val t = SampleTypeAccess().get(id)
        Ok(Json.toJson(t.map(SampleTypeAccess().findDescendants()(_))))
      }
      else
        Ok(Json.toJson(SampleTypeAccess().findDescendantsId()(id)))
    }
  }
}

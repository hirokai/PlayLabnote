package controllers

import play.api._
import play.api.mvc._

object Application extends Controller {

  def index = Action {
    Ok(views.html.index())
  }
}

object Util {
  def toIdOpt(s: String): Option[models.Database.Id] = {
    try{
      Some(s.toLong)
    }catch {
      case _: NumberFormatException => None
      case e: Throwable => throw e
    }
  }
}


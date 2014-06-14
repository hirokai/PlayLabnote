package controllers

import play.api._
import play.api.mvc._

object Application extends Controller {



}

object Util {
  def toIdOpt(s: String): Option[models.Database.Id] = toLongOpt(s)

  def toLongOpt(s: String): Option[models.Database.Id] = {
    try{
      Some(s.toLong)
    }catch {
      case _: NumberFormatException => None
      case e: Throwable => throw e
    }
  }
}


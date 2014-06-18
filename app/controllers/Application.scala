package controllers
import play.api.libs.ws.WS

import play.api.mvc._
import play.cache.Cache
import scala.collection.mutable.ArrayBuffer
import java.sql.Connection
import models.Database._
import scala.Some
import anorm._
import models.Database.Id
import scala.Some
import play.api.db.DB
import play.libs.F.Promise
import scala.concurrent.Future
import play.Logger
import play.api.libs.json.Json
import models.UserAccess


object Application extends Controller {
  import play.Play

  import play.api.Play.current

  def createNewUser() = Action {
    DB.withConnection {implicit c =>

    }
    Ok("stub")
  }

  def getLoginStatus = Action {request =>
    val a = request.headers.get("Authorization")
    a match {
      case Some(auth) => {
        val token = auth.split(" ")(1)
        DB.withConnection {implicit c =>
          val r = SQL(s"SELECT * from User where api_secret='$token'")().map{row =>
            (row[Id]("id"),row[String]("email"),row[String]("api_secret"))
          }.headOption
          r match {
            case Some((id,email,api_secret)) =>
              Ok(Json.obj("logged_in" -> true, "id" -> id, "email" -> email, "api_secret" -> api_secret))
            case _ =>
              Ok(Json.obj("logged_in" -> false))
          }
//          Logger.debug("getUserId: "+r.map(_.toString).getOrElse("None")+" with token: "+token)
        }
      }
      case _ => Ok(Json.obj("logged_in" -> false))
    }
  }

  def getUserId[A](req: Request[A])(implicit c: Connection): Option[Id] = {
    val a = req.headers.get("Authorization")
    a match {
      case Some(auth) => {
        val token = auth.split(" ")(1)
        Logger.debug("Token is" + token)
        val r = SQL(s"SELECT id from User where api_secret='$token'")().map(_[Id]("id")).headOption
        Logger.debug("getUserId: "+r.map(_.toString).getOrElse("None")+" with token: "+token)
        r
      }
      case _ => None
    }
  }

  private def addUserToken(email: String, accessToken: String, expiresIn: Int): Boolean = {
    import play.api.Play.current
    println(email,accessToken,expiresIn)
    DB.withConnection{implicit c =>
      if(0 == SQL(s"SELECT count(*) as c from User where email='$email'")().map(_[Long]("c")).head){
        UserAccess().setupUser(email)
      }
      1 == SQL(s"UPDATE User SET api_secret='$accessToken' where email='$email'").executeUpdate()
    }
  }

  def getStateKey = Action {request =>
    if(Cache.get("state_key") == null){
      Cache.set("state_key",scala.util.Random.alphanumeric.take(30).mkString,60*10)
    }
    Ok(Cache.get("state_key").asInstanceOf[String])
  }

  def loginByOAuth2Token(email: String, access_token: String): Future[Result] = {
    import scala.concurrent.ExecutionContext.Implicits.global
    val url = "https://www.googleapis.com/oauth2/v1/tokeninfo"
    WS.url(url).withQueryString("access_token" -> access_token).get().map{res =>
      val j = res.json
      Logger.debug(res.body)
      val email_s = (j \ "email").as[String]
      val expires = (j \ "expires_in").as[Int]
      if(email == email_s){
        addUserToken(email,access_token,expires)
        Ok(Json.obj("email" -> email))
      }else{
        Status(400)("Email address incorrect.")
      }
    }
  }

  def login = Action.async(parse.tolerantFormUrlEncoded) {request =>
    import scala.concurrent.ExecutionContext.Implicits.global
    val params = request.body
    val e = params.get("email").flatMap(_.headOption)

    val a = request.headers.get("Authorization")
    (e,a) match {
      case (Some(email),Some(auth)) => {
        val token: String = auth.split(" ")(1)
        loginByOAuth2Token(email,token)
      }
      case _ => Future(Status(400)("Missing Auth info."))
    }
  }

  def logout = Action { request =>
    DB.withConnection{implicit c =>
      val u: Option[Id] = Application.getUserId(request)
      u.map{id =>
        if(1 == SQL(s"UPDATE User SET api_secret=null where id=$id").executeUpdate()){
          Ok(Json.obj("success"->true))
        }else{
          Status(400)
        }
      }.getOrElse(Status(400))
    }
  }

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


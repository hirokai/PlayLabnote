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


  def getUserId[A](req: Request[A])(implicit c: Connection): Option[Id] = {
    val a = req.headers.get("Authorization")
    a match {
      case Some(auth) => {
        val token = auth.split(" ")(1)
        val r = SQL(s"SELECT id from User where api_secret='$token'")().map(_[Id]("id")).headOption
        Logger.debug("getUserId: "+r.map(_.toString).getOrElse("None")+" with token: "+token)
        r
      }
      case _ => None
    }
  }

  import play.api.Play.current
  private def addUserToken(email: String, apiKey: String, accessToken: String, expiresIn: Int): Boolean = {
    println(email,apiKey,accessToken,expiresIn)
    DB.withConnection{implicit c =>
      if(0 == SQL(s"SELECT count(*) as c from User where email='$email'")().map(_[Long]("c")).head){
        val u: Option[Id] = SQL(s"INSERT into User(email) values('${escape(email)}')").executeInsert()
        u.map(setupForNewUser)
      }
      1 == SQL(s"UPDATE User SET api_secret='$apiKey' where email='$email'").executeUpdate()
    }
  }

  def setupForNewUser(uid: Id)(implicit c: Connection) {
    val r = SQL(s"INSERT into SampleType(owner,name,system) values($uid,'Any',true)").executeInsert()
    models.SampleDatabase(Some(uid)).setup()
  }

  def getStateKey = Action {request =>
    if(Cache.get("state_key") == null){
      Cache.set("state_key",scala.util.Random.alphanumeric.take(30).mkString,60*10)
    }
    Ok(Cache.get("state_key").asInstanceOf[String])
  }

  // https://developers.google.com/accounts/docs/OAuth2Login
  def googleOAuth2Callback = Action.async { request =>
    import play.api.Play.current
    import scala.concurrent.ExecutionContext.Implicits.global

    val c = request.getQueryString("code")
    val s: Option[String] = request.getQueryString("state")
    println(c,s)
    val res: Future[Result] = (c,s) match {
      case (Some(code),Some(state)) => {
        val client_id: String = Play.application().configuration().getString("oauth2.google.client_id")
        val client_secret: String = Play.application().configuration().getString("oauth2.google.client_secret")
        val redirect_uri = Play.application().configuration().getString("oauth2.google.redirect_uri")

        val stateKey = Cache.get("state_key").asInstanceOf[String]
        if(stateKey != state){
          Future {Ok("Please reload the top page and login again.")}
        }else{
          val promise: Future[Result] = WS.url("https://accounts.google.com/o/oauth2/token").post(Map(
            "code" -> Seq(code),
            "client_id" -> Seq(client_id),
            "client_secret" -> Seq(client_secret),
            "redirect_uri" -> Seq(redirect_uri),
            "grant_type" -> Seq("authorization_code")
          )).flatMap{res =>
            val json = res.json
            val accessToken = (json \ "access_token").as[String]
            val expiresIn = (json \ "expires_in").as[Int]
            val url = "https://www.googleapis.com/oauth2/v1/tokeninfo"
            WS.url(url).withQueryString("id_token" -> (json \ "id_token").as[String]).get().map{res =>
              println(res.body)
              val json = res.json
              if((json \ "issuer").as[String] == "accounts.google.com" && (json \ "audience").as[String] == client_id){
                //This is correct ID.
                val email = (json \ "email").as[String]
                val api_secret = scala.util.Random.alphanumeric.take(30).mkString
                addUserToken(email, api_secret, accessToken, expiresIn)
                Ok(views.html.loggedIn(email,api_secret))
              }else{
                println("Not correct ID",(json \ "issuer").as[String],(json \ "audience").as[String])
                Ok("failed")
              }
            }
          }
          promise
        }
      }
      case _ => Future {Ok("failed")}
    }
    res
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


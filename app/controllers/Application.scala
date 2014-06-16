package controllers

import play.api._
import play.api.mvc._
import play.cache.Cache
import play.libs.Akka
import scala.concurrent.duration
import play.api.libs.ws.WS

object Global extends GlobalSettings {

  override def onStart(app: Application) {
    Logger.info("Application has started")

//    import play.api.libs.concurrent.Execution.Implicits._
//    Akka.system.scheduler.scheduleOnce(0 seconds){
//
//    }
  }

  override def onStop(app: Application) {
    Logger.info("Application shutdown...")
  }

}

object Application extends Controller {
  import play.Play


  // https://developers.google.com/accounts/docs/OAuth2Login
  def googleOAuth2Callback = Action { request =>
    val c = request.getQueryString("code")
    val s: Option[String] = request.getQueryString("state")
    println(c,s,s == Some(Cache.get("state").asInstanceOf[String]))
    (c,s) match {
      case (Some(code),Some(state)) => {
        val client_id: String = Play.application().configuration().getString("oauth2.google.client_id")
        val client_secret: String = Play.application().configuration().getString("oauth2.google.client_secret")
        val redirect_uri = Play.application().configuration().getString("oauth2.google.redirect_uri")

        import play.api.Play.current
        import scala.concurrent.ExecutionContext.Implicits.global
        WS.url("https://accounts.google.com/o/oauth2/token").post(Map(
          "code" -> Seq(code),
          "client_id" -> Seq(client_id),
          "client_secret" -> Seq(client_secret),
          "redirect_uri" -> Seq(redirect_uri),
          "grant_type" -> Seq("authorization_code")
        )).map{res =>
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
               addUserToken(email, state, accessToken, expiresIn)
             }else{
               println("Not correct ID",(json \ "issuer").as[String],(json \ "audience").as[String])
             }
          }
//          addUserToken()
          Cache.set("",(json \ "access_token").as[String])
        }
      }
      case _ =>
        Ok("Login failed. Open the top page and try logging in again.")
    }
    Ok(views.html.loggedIn())
  }

  private def addUserToken(email: String, state: String, accessToken: String, expiresIn: Int) {
    println(email,state,accessToken,expiresIn)
  }

  def getStateKey = Action {request =>
    val str = scala.util.Random.alphanumeric.take(30).mkString
    Ok(str)
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


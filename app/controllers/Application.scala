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
import models.{ExperimentAccess, UserAccess}
import java.io.{ByteArrayOutputStream, FileInputStream}
import play.api.libs.iteratee.Enumerator
import org.apache.poi.util.IOUtils


object Application extends Controller {
  import play.Play

  import play.api.Play.current

  def createNewUser() = Action {
    DB.withConnection {implicit c =>

    }
    Ok("stub")
  }

  def getUserIdAndAccessToken[A](req: Request[A])(implicit c: Connection): Option[(Id,String)] = {
    val a = req.headers.get("Authorization")
    a match {
      case Some(auth) => {
        val token = auth.split(" ")(1)
        Logger.debug("Token is" + token)
        val r = SQL(s"SELECT User.id from User inner join Client on User.id=Client.user where Client.access_token='$token'")().map(_[Id]("User.id")).headOption
        Logger.debug("getUserId: "+r.map(_.toString).getOrElse("None")+" with token: "+token)
        r.map(id => (id,token))
      }
      case _ => None
    }
  }

  def getLoginStatus = Action {request =>
    val a = request.headers.get("Authorization")
    a match {
      case Some(auth) => {
        val token = auth.split(" ")(1)
        DB.withConnection {implicit c =>
          val r = SQL(s"SELECT * from Client inner join User on Client.user=User.id where Client.access_token='$token'")().map{row =>
            (row[Id]("User.id"),row[String]("User.email"),row[String]("Client.access_token"))
          }.headOption
          r match {
            case Some((id,email,access_token)) =>
              Ok(Json.obj("logged_in" -> true, "id" -> id, "email" -> email, "access_token" -> access_token))
            case _ =>
              Ok(Json.obj("logged_in" -> false))
          }
          //          Logger.debug("getUserId: "+r.map(_.toString).getOrElse("None")+" with token: "+token)
        }
      }
      case _ => Ok(Json.obj("logged_in" -> false))
    }
  }

  def getUserIdFromToken(token: String)(implicit c: Connection): Option[Id] = {
    Logger.debug("Token is" + token)
    val r = SQL(s"SELECT User.id from User inner join Client on User.id=Client.user where Client.access_token='$token'")().map(_[Id]("User.id")).headOption
    Logger.debug("getUserId: "+r.map(_.toString).getOrElse("None")+" with token: "+token)
    r
  }

  def getUserId[A](req: Request[A])(implicit c: Connection): Option[Id] = {
    val a = req.headers.get("Authorization")
    a match {
      case Some(auth) => {
        val token = auth.split(" ")(1)
        getUserIdFromToken(token)
      }
      case _ => None
    }
  }

  //This allows multiple access_token's from multiple browsers of the same account (email).
  private def addUserToken(email: String, accessToken: String, expiresIn: Int): Boolean = {
    import play.api.Play.current
    println(email,accessToken,expiresIn)
    DB.withConnection{implicit c =>
      if(0 == SQL(s"SELECT count(*) as c from User where email='$email'")().map(_[Long]("c")).head){
        UserAccess().setupUser(email)
      }
      val uid = SQL(s"SELECT id from User where email='$email'")().map(_[Id]("id")).head
      1 == SQL(s"INSERT into Client(user,access_token,client) values($uid,'$accessToken','stub')").executeUpdate()
    }
  }

  def getAccessToken[A](req: Request[A])(implicit c: Connection): Option[String] = {
    val a = req.headers.get("Authorization")
    a match {
      case Some(auth) => {
        val token = auth.split(" ")(1)
        Some(token)
      }
      case _ => None
    }
  }

  def getStateKey = Action {request =>
    if(Cache.get("state_key") == null){
      Cache.set("state_key",scala.util.Random.alphanumeric.take(30).mkString,60*10)
    }
    Ok(Cache.get("state_key").asInstanceOf[String])
  }

  //This does not rely on Authorizaion header. The access_token is being revoked soon so this is safe.
  def logout = Action { request =>
    DB.withConnection{implicit c =>
      val t = request.getQueryString("access_token")
      t.map{token =>
        if(1 == SQL(s"DELETE Client where access_token='$token'").executeUpdate()){
          Ok(Json.obj("success"->true))
        }else{
          Status(400)
        }
      }.getOrElse(Status(400))
    }
  }

  //This is for server side auth
  // I've switched between different options so many times, but seems this works fine.
  //https://developers.google.com/accounts/docs/OAuth2Login
  def oauth2Callback = Action.async {request =>
    import play.api.Play
    import scala.concurrent.ExecutionContext.Implicits.global

    val clientId = Play.current.configuration.getString("oauth2.google.client_id").get
    val secret = Play.current.configuration.getString("oauth2.google.client_secret").get
    val redirectUri = Play.current.configuration.getString("oauth2.google.redirect_uri").get


    var state: String = request.getQueryString("state").get
    var code: String = request.getQueryString("code").get
    WS.url("https://accounts.google.com/o/oauth2/token").post(Map(
      "code" -> Seq(code),
      "client_id" -> Seq(clientId),
      "client_secret" -> Seq(secret),
      "redirect_uri" -> Seq(redirectUri),
      "grant_type" -> Seq("authorization_code")
    )).flatMap{res =>
      val j = res.json
      val id_token = (j \ "id_token").as[String]
      val access_token = (j \ "access_token").as[String]
      WS.url("https://www.googleapis.com/oauth2/v1/tokeninfo").withQueryString("id_token" -> id_token).get().map{res2 =>
        val j2 = res2.json
        val email = (j2 \ "email").as[String]
        val expires = (j2 \ "expires_in").as[Int]
        addUserToken(email,access_token,expires)
        Ok(views.html.loggedIn(email,access_token))
      }
    }
  }

  def saveDBToGDrive = Action.async {request =>
    import scala.concurrent.ExecutionContext.Implicits.global
    DB.withConnection{implicit c =>
      try{
      val (uid,accessToken) = Application.getUserIdAndAccessToken(request).get
      val file = models.Serialize.dumpAll(uid).get
      val u: Option[Id] = Some(uid)
      val boundary = "-------314159265358979323846"
      val delimiter = "\r\n--" + boundary + "\r\n"
      val close_delim = "\r\n--" + boundary + "--"

      import org.apache.commons.codec.binary.Base64OutputStream

      val instream = new FileInputStream(file)
      val byteOut = new ByteArrayOutputStream
      val out = new Base64OutputStream(byteOut)
      IOUtils.copy(instream,out)
      out.close()
      instream.close()
      val fileData: String = byteOut.toString

      val title = "Labnotebook all database dump.zip"

      val multipartRequestBody =
        delimiter + "Content-Type: application/json\r\n\r\n" +
          Json.obj("title" -> title, "mimeType" -> "text/csv").toString +
          delimiter + "Content-Type: application/zip" + "\r\n" +
          "Content-Transfer-Encoding: base64\r\n" +
          "\r\n" +
          fileData + close_delim


      WS.url("https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&convert=true")
        .withHeaders(
        "Authorization" -> ("Bearer "+accessToken),
        "Content-Type" -> ("multipart/mixed; boundary='" + boundary + "'"))
        .post(multipartRequestBody).map{res =>
        val j = res.json
        val sheet = (j \ "id").as[String]
        Ok(j)
      }
      }catch{
        case _: NoSuchElementException => Future(BadRequest("Error."))
      }
    }
  }

  def emailDB = Action {
    Ok("")
  }

  def downloadDB = Action { request =>
    import scala.concurrent.ExecutionContext.Implicits.global

    DB.withConnection {implicit c =>
      val t = request.getQueryString("access_token")
      t match {
        case Some(token) => {
          val u = getUserIdFromToken(token)
          u match {
            case Some(uid) => {
              models.Serialize.dumpAll(uid) match {
                case Some(file) =>{
                  val fileContent: Enumerator[Array[Byte]] = Enumerator.fromFile(file)
                  Result(
                    header = ResponseHeader(200),
                    body = fileContent
                  ).as("application/zip")
                }
                case None =>
                  Status(400)("DB error.")
              }
            }
            case _ =>
              Status(400)("Not authorized.")
          }
        }
        case None =>
          Status(400)("Login is needed.")
      }
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


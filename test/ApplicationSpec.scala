import models.Database
import org.specs2.mutable._
import org.specs2.runner._
import org.junit.runner._

import play.api.db.DB
import play.api.libs.json.Json
import play.api.test._
import play.api.test.Helpers._
import play.api.Play.current
import scala.reflect.ClassTag


object Util {

  import scala.util.Random
  def genNames(n: Int): Array[String] = {
    (0 until n).map{ _ =>
      if(Random.nextInt(10) < 3){
        val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz 0123456789.'+-!@#$%^&*()_+|~}{\"?><M<".toCharArray
        val len = chars.length
        val slen = Random.nextInt(50)+1
        (0 until slen).map(_ => chars(Random.nextInt(len))).mkString
      }
      else
        Random.nextString(Random.nextInt(50)+1)
    }.toArray
  }

  def genAndChoose(a: Int, b: Int): Array[String] = choose(genNames(a),b)
  // genAndChoose(a,b).length == b && genAndChoose(a,b).distinct.length = a

  def choose[A: ClassTag](vs: Array[A], n: Int): Array[A] = {
    val len = vs.length
    (0 until n).map(_ => vs(Random.nextInt(len))).toArray
  }

}

/**
 * Add your spec here.
 * You can mock out a whole application including requests, plugins etc.
 * For more information, consult the wiki.
 */
@RunWith(classOf[JUnitRunner])
class ApplicationSpec extends Specification {

  import Util._

  "Application" should {

    val u = Some(Database.sandboxUserId)

    "send 404 on a bad request" in new WithApplication{
      route(FakeRequest(GET, "/boum")) must beNone
    }

    "render the index page" in new WithApplication{
      val home = route(FakeRequest(GET, "/")).get

      status(home) must equalTo(OK)
      contentType(home) must beSome.which(_ == "text/html")
      contentAsString(home) must contain ("ng-app")
    }

    import models._
    import scala.util.Random

    "add then remove exps must be no change" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){

        DB.withConnection{implicit c =>
          val len = 1000
          val names: Array[String] = genNames(100)
          val ns = choose(names,len)
          val es = for(n <- ns) yield {
            ExperimentAccess(u).create(n)
          }
          ExperimentAccess(u).countTotal must equalTo(len)

          for(Some(e) <- es){
            ExperimentAccess(u).delete(e)
          }
          ExperimentAccess(u).countTotal must equalTo(0)
        }
      }
    }

    "remove exp removes all expruns and psamples" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){
        DB.withConnection{implicit c =>
//          ExpRunAccess().create(e,genNames(1000))_
        }
        true
      }
    }

    "add then remove samples must be no change" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){


        DB.withConnection{implicit c =>
          val tid = SampleTypeAccess(u).getAnyTypeId
          val len = 1000
          val names: Array[String] = genNames(100)
          val ns = choose(names,len)
          val es = for(n <- ns) yield {
            SampleAccess(u).create(n,tid)
          }
          SampleAccess(u).countTotal must equalTo(len)
          for(Some(e) <- es){
            SampleAccess(u).delete(e)
          }
          SampleAccess(u).countTotal must equalTo(0)

        }
      }
    }
  }
}

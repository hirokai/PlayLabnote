import controllers.Application
import java.sql.Connection
import models._
import models.Database.Id
import org.specs2.mutable._
import org.specs2.runner._
import org.junit.runner._

import play.api.db.DB
import play.api.libs.json.Json
import play.api.test._
import play.api.test.Helpers._
import play.api.Play.current
import scala.collection.mutable.ArrayBuffer
import scala.reflect.ClassTag
import anorm._


object Util {

  import scala.util.Random
  def genAlphaNames(n: Int): Array[String] = genNames(n,1)

  def genNames(n: Int, prob: Double = 0.3): Array[String] = {
    (0 until n).map{ _ =>
      if(Random.nextDouble <= prob){
        val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz 0123456789.'+-!@#$%^&*()_+|~}{\"?><M<".toCharArray
        val len = chars.length
        val slen = Random.nextInt(50)+1
        (0 until slen).map(_ => chars(Random.nextInt(len))).mkString
      }
      else
        Random.nextString(Random.nextInt(50)+1)
    }.toArray
  }

  def randomStr(n: Int) = Random.alphanumeric.take(n).mkString

  def genAndChoose(a: Int, b: Int): Array[String] = choose(genNames(a),b)
  // genAndChoose(a,b).length == b && genAndChoose(a,b).distinct.length = a

  def choose[A: ClassTag](vs: Array[A], n: Int): Array[A] = {
    val len = vs.length
    (0 until n).map(_ => vs(Random.nextInt(len))).toArray
  }

  def addTypes(uid: Id,len: Int)(implicit c: Connection) {
    val u = Some(uid)
    val len = 20
    val any = SampleTypeAccess(u).getAnyType
    val ts = ArrayBuffer[Id](any.id)
    for(i <- 0 until len){
      val name = randomStr(10)
      val parent = ts(Random.nextInt(ts.length))
      ts += SampleTypeAccess(u).create(name,parent).get
    }
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

    "removing experiment must be successful any time" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){
        DB.withConnection{implicit c =>
          true
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

@RunWith(classOf[JUnitRunner])
class SampleTypeSpec extends Specification {
  import Util._
  import scala.util.Random

  def deleteAllTypes(uid: Id)(implicit c: Connection) {
    val u = Some(uid)
    val any = SampleTypeAccess(u).getAnyType
    val ts = SampleTypeAccess(u).getTypeTree()(any).flatten
    for(t<-ts){
      SampleTypeAccess(u).delete(t.id, subtypes = true)
    }
  }

  "SampleType" should {
    "adding is done correctly" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){
        DB.withConnection{implicit c =>
          val u = Some(Database.sandboxUserId)
          val len = 20
          addTypes(Database.sandboxUserId,len)
          val any = SampleTypeAccess(u).getAnyType
          SampleTypeAccess(u).getTypeTree()(any).flatten must have size(len+1)
        }
      }
    }

    "Adding sample types does not affect other user's sample types" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){
        DB.withConnection{implicit c =>
          for(i <- 0 until 30) {
            UserAccess().setupUser(randomStr(5)+"@gmail.com", addInitialData = false)
          }
          val us: List[Id] = UserAccess().listUserIDs.toList
          val u2 = us(Random.nextInt(30))
          val u = Some(u2)
          val len = 20
          addTypes(u2,len)
          val any = SampleTypeAccess(u).getAnyType
          SampleTypeAccess(u).getTypeTree()(any).flatten must have size(len+1)

          for(u3<-us if u3 != u2){
            SampleAccess(Some(u3)).list must have size(0)
          }
          true
        }
      }
    }

    "Does not delete system samples"

    "Deleting is separate for users" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){
        DB.withConnection{implicit c =>
          val numUsers = 20
          for(i <- 0 until numUsers) {
            UserAccess().setupUser(randomStr(5)+"@gmail.com", addInitialData = false)
          }
          val us: List[Id] = UserAccess().listUserIDs.toList
          val len = 20
          for(u2<-us){
            val u = Some(u2)
            val any = SampleTypeAccess(u).getAnyType
            addTypes(u2,len)
          }
          val u3 = us(Random.nextInt(numUsers))
          deleteAllTypes(u3)
          for(u4<-us if u4 != u3){
            val u = Some(u4)
            val any = SampleTypeAccess(u).getAnyType
            SampleTypeAccess(u).getTypeTree()(any).flatten must have size(len+1)
          }
          SampleTypeAccess(Some(u3)).getTypeTree()(SampleTypeAccess(Some(u3)).getAnyType).flatten must have size(1)
        }
      }
    }
  }
}

@RunWith(classOf[JUnitRunner])
class SampleSpec extends Specification {
  import Util._
  import scala.util.Random

  val u = Some(Database.sandboxUserId)

  "Sample" should {
    "adding is done correctly" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){
        DB.withConnection{implicit c =>
          val len = 50
          val names = genNames(len)
          val tid = SampleTypeAccess(u).getAnyTypeId
          for(name <- names){
            val id = SampleAccess(u).create(name,tid)
            id must beSome
            val s = SampleAccess(u).get(id.get)
            s must beSome
            s.get.name must_== name
            s.get.typ must beRight
          }
          SampleAccess(u).list.length must_== len
        }
      }
    }
    "Samples are separate from other user's samples" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){
        DB.withConnection{implicit c =>
          for(i <- 0 until 30) {
            UserAccess().setupUser(randomStr(5)+"@gmail.com", addInitialData = false)
          }
          val  us2: List[Id] = UserAccess().listUserIDs.toList
          val us: Array[Id] = Random.shuffle(us2).take(10).toArray
          println(us.mkString(","))

          val u2 = us(Random.nextInt(10))
          val u = Some(u2)
          val len = 50
          val names = genAlphaNames(len)
          val tid = SampleTypeAccess(u).getAnyTypeId
          for(name <- names){
            val id = SampleAccess(u).create(name,tid)
          }
          SampleAccess(u).list must have size(len)

          for(u3<-us if u3 != u2){
            SampleAccess(Some(u3)).list must have size(0)
          }
          true
        }
      }
    }
  }
}

@RunWith(classOf[JUnitRunner])
class ExpSpec extends Specification {
  import Util._
  import scala.util.Random

  "Experiment" should {
    "be created and deleted correctly" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){
        DB.withConnection{implicit c =>
          val uid = UserAccess().setupUser(randomStr(5)+"@gmail.com", addInitialData = false).get
          val u = Some(uid)

          val len = 50
          for(i <- 0 until len){
            ExperimentAccess(u).create(randomStr(5))
          }
          val exps = ExperimentAccess(u).list
          exps must have size(len)
          for(e <- exps){
            ExperimentAccess(u).delete(e.id)
          }
          ExperimentAccess(u).list must have size(0)
        }
      }
    }
  }

  "RunSample" should {
    "not have incompatible type"

    "belong to only one exp"
  }

  "PSample" should {
    "belong to only one exp" in {
      running(FakeApplication(additionalConfiguration = inMemoryDatabase())){
        DB.withConnection{implicit c =>
        //Prepare user
          val uid = UserAccess().setupUser(randomStr(5)+"@gmail.com", addInitialData = false).get
          val u = Some(uid)

          //Prepare types
          addTypes(uid,20)
          val any = SampleTypeAccess(u).getAnyTypeId
          val ts = SampleTypeAccess(u).getTypeIdTree()(any).flatten

          //Prepare exp and other exps
          val exp = ExperimentAccess(u).create(randomStr(5)).get
          val others = for(i <- 0 until 10) yield {
            ExperimentAccess(u).create(randomStr(5)).get
          }

          for(i <- 0 until 10){
            ProtocolSampleAccess(u).create(exp,randomStr(5),ts(Random.nextInt(ts.length)))
          }

          for(e <- others){
             ExperimentAccess(u).getProtocolSamples(e) must have size 0
          }
          true
        }
      }
    }
  }
}
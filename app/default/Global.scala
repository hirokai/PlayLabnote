import play.api.{Logger, Application, GlobalSettings}
import play.cache.Cache
import scala.collection.mutable.ArrayBuffer

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
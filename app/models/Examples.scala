package models

import play.api.db.DB
import play.api.Play.current
import play.Logger

case class SampleDatabase(owner: Option[Database.Id]) {
  def setup() {
    DB.withTransaction {
      implicit c =>
        try {
          val any = SampleType.getAnyTypeId(owner)
          val o_t1 = SampleTypeAccess(owner).getOrCreate("Substrate", any)
          val o_t2 = SampleTypeAccess(owner).getOrCreate("SUVs", any)
          o_t2.flatMap {
            t2 =>
              val t3 = SampleTypeAccess(owner).getOrCreate("Lipids", any)
              val t4 = SampleTypeAccess(owner).getOrCreate("Fab materials", any)
              val s1 = SampleAccess(owner).create("SUVs 1",t2)
              val o_e1 = ExperimentAccess(owner).create("Making SUVs")
              o_e1.flatMap {
                e1 =>
                  val o_p1 = ExperimentAccess(owner).addProtocolSample(e1, "SUVs", t2)
                  val p2 = ExperimentAccess(owner).addProtocolSample(e1, "Lipid 1", t2)
                  val p3 = ExperimentAccess(owner).addProtocolSample(e1, "Lipid 2", t2)
                  val o_r1 = ExperimentAccess(owner).addRun(e1, "Run 1")
                  ExperimentAccess(owner).addRun(e1, "Run 2")
                  ExperimentAccess(owner).addRun(e1, "Run 3")
                  (o_p1, o_r1) match {
                    case (Some(p1), Some(r1)) =>
                      ExperimentAccess(owner).assignNewSample(p1, r1, "Sample 1", t2)
                    case _ => None
                  }
              }
          }
        } catch {
          case e: Throwable => {
            c.rollback()
            Logger.error("DB error. Roll back done.")
            println(e.getMessage)
          }
        }
    }
  }
}
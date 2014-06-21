package models

import com.github.nscala_time.time.Imports._
import anorm._

import Database.Id
import java.sql.Connection
import java.io.{FileWriter, File}
import play.api.libs.json.Json

object Serialize {
  import JsonWriter._

  def dumpAll(uid: Id)(implicit c: Connection): Option[File] = {
    val u = Some(uid)

    val fmt = DateTimeFormat.forPattern("yyyy-MM-dd_HH-mm-ss.SSS")
    val subfolder = fmt.print(DateTime.now) + " user" + uid.toString
    val folder = "var"+ File.separator + subfolder

    val f = new File(folder)
    f.mkdirs()
    val basename = f.getPath + File.separator

    val exps = ExperimentAccess(u).list(full = true)
    val samples = SampleAccess(u).list
    val types = SampleTypeAccess(u).getTypeTree()(SampleTypeAccess(u).getAnyType)

    var name = basename + "exp.json"
    var str = Json.prettyPrint(Json.toJson(exps))
    var fw = new FileWriter(name)
    fw.write(str)
    fw.close()

    name = basename + "sample.json"
    str = Json.prettyPrint(Json.toJson(samples))
    fw = new FileWriter(name)
    fw.write(str)
    fw.close()

    name = basename + "sampletype.json"
    str = Json.prettyPrint(mkTreeJson(types))
    fw = new FileWriter(name)
    fw.write(str)
    fw.close()

    name = basename + "metadata.json"
    str = Json.prettyPrint(Json.obj("version" -> 1, "website" -> "https://labnote.net"))
    fw = new FileWriter(name)
    fw.write(str)
    fw.close()

    val outfile = "var/"+subfolder+".zip"
    mkArchive(outfile, subfolder, f)
    Some(new File(outfile))

  }

  //FIXME: Add all tables
  def dumpAllRawDB(uid: Id)(implicit c: Connection): Option[File] = {
    val fmt = DateTimeFormat.forPattern("yyyy-MM-dd_HH-mm-ss.SSS")
    val subfolder = fmt.print(DateTime.now) + " user" + uid.toString
    val folder = "var"+ File.separator + subfolder

    val f = new File(folder)
    f.mkdir()

    val basename = f.getPath + File.separator

    var name = basename + "exp.csv"
    var query = s"SELECT * from Experiment where owner=$uid"
    SQL("CALL CSVWRITE('"+name+"', '"+query+"')").execute()

    name = basename + "sampletype.csv"
    query = s"SELECT * from SampleType where owner=$uid"
    SQL("CALL CSVWRITE('"+name+"', '"+query+"')").execute()

    name = basename + "sample.csv"
    query = s"SELECT * from Sample where owner=$uid"
    SQL("CALL CSVWRITE('"+name+"', '"+query+"')").execute()

    name = basename + "sampledata.csv"
    query = s"SELECT * from SampleData inner join Sample on Sample.id=SampleData.sample where Sample.owner=$uid"
    SQL("CALL CSVWRITE('"+name+"', '"+query+"')").execute()

    name = basename + "ExpRun.csv"
    query = s"SELECT * from ExpRun inner join Experiment on Experiment.id=ExpRun.experiment where Experiment.owner=$uid"
    SQL("CALL CSVWRITE('"+name+"', '"+query+"')").execute()

    name = basename + "ProtocolSample.csv"
    query = s"SELECT * from ProtocolSample inner join Experiment on Experiment.id=ProtocolSample.experiment where Experiment.owner=$uid"
    SQL("CALL CSVWRITE('"+name+"', '"+query+"')").execute()

    name = basename + "SampleInRun.csv"
    query = s"SELECT * from SampleInRun inner join Sample on Sample.id=SampleInRun.sample where Sample.owner=$uid"
    SQL("CALL CSVWRITE('"+name+"', '"+query+"')").execute()

    name = basename + "ProtocolStep.csv"
    query = s"SELECT * from ProtocolStep inner join Experiment on Experiment.id=ProtocolStep.experiment where Experiment.owner=$uid"
    SQL("CALL CSVWRITE('"+name+"', '"+query+"')").execute()

    name = basename + "tables.txt"
    SQL("SCRIPT NODATA TO '"+name+"'").execute()

    val str = Json.obj("version" -> 1, "website" -> "https://labnote.net").toString
    name = basename + "metadata.json"
    val fw = new FileWriter(name)
    fw.write(str)
    fw.close()

    val outfile = "var/"+subfolder+".zip"
    mkArchive(outfile, subfolder, f)
    Some(new File(outfile))
  }

  private def mkArchive(out: String, date: String, folder: File) {
    val files: Iterable[String] = folder.list()
    import java.io.{ BufferedInputStream, FileInputStream, FileOutputStream }
    import java.util.zip.{ ZipEntry, ZipOutputStream }

    val zip = new ZipOutputStream(new FileOutputStream(out))

    files.foreach { name =>
      zip.putNextEntry(new ZipEntry(date+File.separator+name))
      val in = new BufferedInputStream(new FileInputStream(folder.getPath+File.separator+name))
      var b = in.read()
      while (b > -1) {
        zip.write(b)
        b = in.read()
      }
      in.close()
      zip.closeEntry()
    }
    zip.close()
  }
}

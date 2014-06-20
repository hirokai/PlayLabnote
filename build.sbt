name := """LabnoteServer"""

version := "0.1-SNAPSHOT"

lazy val root = (project in file(".")).enablePlugins(PlayScala).dependsOn(uri("git://github.com/guardian/sbt-jasmine-plugin.git#1.1"))

scalaVersion := "2.11.1"

libraryDependencies ++= Seq(
  jdbc,
  anorm,
  cache,
  ws,
  "org.apache.poi" % "poi" % "3.9",
  "commons-codec" % "commons-codec" % "1.9"
  )

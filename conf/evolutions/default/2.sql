# Users schema

# --- !Ups

CREATE TABLE ExpData (
  experiment bigint(20) NOT NULL REFERENCES Experiment(id),
  url  text NOT NULL,
  name text NOT NULL,
  note text,
  icon text,
  type text,
  original_id text,
  id bigint(20) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id)
);

CREATE TABLE ExpDump (
  experiment bigint(20) NOT NULL AUTO_INCREMENT,
  sheet_id text NOT NULL,
  save_count int NOT NULL,
  PRIMARY KEY (experiment)
);

# --- !Downs

DROP TABLE ExpData;
DROP TABLE ExpDump;

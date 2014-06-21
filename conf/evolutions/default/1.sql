# Users schema
 
# --- !Ups

CREATE TABLE User (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  email text NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE UserInfo (
  user_id bigint(20) NOT NULL REFERENCES User(id),
  first_name text,
  last_name text,
  PRIMARY KEY (user_id)
);

INSERT into User(id,email) values(0,'sandbox_noemail');

CREATE TABLE Experiment (
    id bigint(20) NOT NULL AUTO_INCREMENT,
    owner bigint(20 )NOT NULL REFERENCES User(id),
    name text NOT NULL,
    note text,
    PRIMARY KEY (id)
);

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

CREATE TABLE SampleType (
    id bigint(20) NOT NULL AUTO_INCREMENT,
    owner bigint(20) NOT NULL REFERENCES User(id),
    name text NOT NULL,
    note text,
    parent bigint(20) REFERENCES SampleType(id),
    system boolean NOT NULL,
    PRIMARY KEY (id)
);

INSERT into SampleType(id,owner,name,system) values(0,0,'Any',true);

CREATE TABLE Sample (
    id bigint(20) NOT NULL AUTO_INCREMENT,
    owner bigint(20 )NOT NULL REFERENCES User(id),
    name text NOT NULL,
    note text,
    type bigint(20) NOT NULL REFERENCES SampleType(id),
    PRIMARY KEY (id)
);

CREATE TABLE SampleData (
  sample bigint(20) NOT NULL REFERENCES Sample(id),
  url  text NOT NULL,
  name text NOT NULL,
  note text,
  icon text,
  type text,
  original_id text,
  id bigint(20) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id)
);

CREATE TABLE ExpRun (
  experiment bigint(20) NOT NULL REFERENCES Experiment(id),
  name text NOT NULL,
  id bigint(20) NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id)
);


CREATE TABLE ProtocolSample (
    id bigint(20) NOT NULL AUTO_INCREMENT,
    name text NOT NULL,
    experiment bigint(20) NOT NULL REFERENCES Experiment(id),
    type bigint(20) NOT NULL REFERENCES SampleType(id),
    note text,
    PRIMARY KEY (id)
);

CREATE TABLE SampleInRun (
  sample bigint(20) NOT NULL REFERENCES Sample(id),
  protocol_sample bigint(20) NOT NULL REFERENCES ProtocolSample(id),
  run bigint(20) NOT NULL REFERENCES ExpRun(id),
  PRIMARY KEY (run,protocol_sample)
);


CREATE TABLE ProtocolStep (
    id bigint(20) NOT NULL AUTO_INCREMENT,
    experiment bigint(20) NOT NULL REFERENCES Experiment(id),
    name text NOT NULL,
    note text,
    PRIMARY KEY (id)
);

CREATE TABLE ProtocolSampleInStep (
    step bigint(20) NOT NULL REFERENCES ProtocolStep(id),
    sample bigint(20) NOT NULL REFERENCES ProtocolSample(id),
    role text NOT NULL
);

CREATE TABLE ProtocolStepParam (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  step bigint(20) NOT NULL REFERENCES ProtocolStep(id),
  name text NOT NULL,
  param_type text,
  unit text,
  PRIMARY KEY (id)
);

CREATE TABLE RunStep (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  run bigint(20) NOT NULL REFERENCES ExpRun(id),
  protocol_step bigint(20) NOT NULL REFERENCES ProtocolStep(id),
  note text,
  time_at bigint(32),
  time_end bigint(32),
  PRIMARY KEY (id),
  UNIQUE (run,protocol_step)
);

CREATE TABLE RunStepParam (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  step bigint(20) NOT NULL REFERENCES RunStep(id),
  param bigint(20) NOT NULL REFERENCES ProtocolStepParam(id),
  value text NOT NULL,
  PRIMARY KEY (id),
  UNIQUE (step,param)
);

# --- !Downs

DROP TABLE Experiment;
DROP TABLE ExpData;
DROP TABLE SampleType;
DROP TABLE Sample;
DROP TABLE SampleData;
DROP TABLE ExpRun;
DROP TABLE SampleInRun;
DROP TABLE ProtocolSampleInStep;
DROP TABLE ProtocolSample;
DROP TABLE ProtocolStep;
DROP TABLE ProtocolStepParam;
DROP TABLE RunStep;
DROP TABLE RunStepParam;
DROP TABLE UserInfo;
DROP TABLE User;

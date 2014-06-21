# Users schema

# --- !Ups

CREATE TABLE GDriveExportExp (
  experiment bigint(20) NOT NULL REFERENCES Experiment(id),
  sheet_id text NOT NULL,
  save_count int NOT NULL,
  PRIMARY KEY (experiment)
);

CREATE TABLE GDriveExportSample (
  sample bigint(20) NOT NULL REFERENCES Sample(id),
  sheet_id text NOT NULL,
  save_count int NOT NULL,
  PRIMARY KEY (sample)
);

CREATE TABLE GoogleClient (
  id bigint(20) NOT NULL AUTO_INCREMENT,
  user bigint(20) NOT NULL REFERENCES User(id),
  access_token text NOT NULL,
  expires_at bigint(64) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE GoogleAuth (
  user bigint(20) UNIQUE NOT NULL REFERENCES User(id),
  refresh_token text NOT NULL
);

# --- !Downs

DROP TABLE GDriveExportExp;
DROP TABLE GDriveExportSample;
DROP TABLE GoogleClient;
DROP TABLE GoogleAuth;

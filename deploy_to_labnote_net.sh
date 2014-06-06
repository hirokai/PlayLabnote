#!/bin/sh

./activator play-update-secret
./activator dist
scp ./target/universal/labnoteserver-0.1-SNAPSHOT.zip root@labnote.net:~/labnote.zip


#!/bin/sh
ab -k -c20 -n 100000 http://localhost:9000/samples.json
# ab -n 1 -c 1 -p post_data -v 4 -T 'application/x-www-form-urlencoded' http://localhost:9000/samples


#!/bin/sh

if [ ! -z $PREFIX ]
then
  ip route add local $PREFIX dev lo
fi

exec node app.js -c /data/config.yaml -p 8010 -f /data/appservice-registration-irc.yaml -u http://localhost:8010

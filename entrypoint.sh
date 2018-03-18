#!/bin/sh
cd /var/app
npm install
pm2-docker start ctu.js

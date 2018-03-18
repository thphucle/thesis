# SUN Project

## Only work with client project

## Technology Stack
+ NodeJS
+ Express 4.x
+ Postgres 9.x
+ Typescript 2.x
+ Socket.IO 1.7.x

## How to run
+ `npm install` (`sudo npm install` if linux/osx)
+ `gulp` to test if runable or not
+ `node dist/server` to run server, or
+ `nodemon dist/server` to run & watch


## Simplest way:
```
docker-compose up
```

## How to install postgis
```
+ Go to bash in postgres docker: 'docker exec -it [postgres_container] bash'
+ `su postgres`
+  `psql [db_name] -c "CREATE EXTENSION postgis;"`
```

## Fix backup or restore out of memory
Add ```--max_old_space_size=2048``` when run node
Ex: ```node --max_old_space_size=2048 run backup```

## Test email template
must: NODE_ENV=development
modify `src/routes/email-test.ts` to return sample data for template file.
route test: /email-template/[template-file]

Happy Coding

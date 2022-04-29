# templ-deploy
Deploy files to Templ (https://templ.io) using rsync.

## Install
```
npm i -D git@github.com:herman-templio/templ-deploy.git
```

Or, if you're developing this package, simplest is to clone it into a local directory, then to use it in another module:
```
npm i -D path/to/templ-deploy
```

## Configure
Create a file .templ.mjs containing for example:

```
const config = {
    options:{
        dir:'dist'
    },
    templs:{
        'main':{
            app:1234,
            host:'hostname.com',
            port:22342,
        }
    }
}

export default config
````
Add a script to your package.json:
```
"deploy":"templ-deploy"
```
## Use

With the example configuration above:
```
npm run deploy main
```
will deploy the local dir named 'dist' to the given host under the default 'app_1234' directory. 

The config file can contain any number of "templs". If no argument is given on command line, the name of the currently checked out git-branch will be used. In other words: ```npm run deploy``` is equivalent to ```npm run deploy $(git branch --show-current)```.

## Command line options

The following command line options are supported:
+ ```--dry``` - prints the complete rsync-command that will be executed, but does not execute it
+ ```--rsyncFlags <flags>``` - specify flags to pass to rsync. Default flags are ```avzh```

## Configuration options

At top level, the configuration file can contain an ```options``` object, and a ```templs``` object. 

The ```options``` can contain:
+ ```dir``` the directory to deploy
+ ```exclude``` an array of files and directories to exclude

Each ```templ``` can contain the following options:

+ ```app``` a templ app id. Optional. No default.
+ ```host``` a hostname. Required.
+ ```port``` ssh port. Optional. Default: 22.
+ ```user``` ssh user. Optional. Default: ```user_<id>``` if an app id is given.
+ ```dst``` a destination path. Optional. Default: ```app_<id>``` if an app id was given.
+ ```files``` an array of files to copy from the dir. Optional. No default.

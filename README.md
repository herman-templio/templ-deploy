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
            ssh_shell:'./run-after-deploy.sh', // Run remotely after files copied
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

## Configuration options

At top level, the configuration file can contain an ```options``` object, and a ```templs``` object. 

The ```options``` can contain:
+ ```dir``` the directory to deploy. Optional. Default is ```dist```.
+ ```exclude``` an array of files and directories to exclude. Optional. Default empty.
+ ```sshCmd``` - specify a command to be run remotely after deploy.
+ ```deps``` - a list of dependencies. See the Depency section.
+ ```depSsh``` - command to run remotely in the dependency destination directory
+ ```skipRsync``` -  Skip deploying files with rsync. Only run ssh-commands, if any.

Each ```templ``` can contain the following options:

+ ```app``` a templ app id. Optional. No default.
+ ```host``` a hostname. Required.
+ ```port``` ssh port. Optional. Default: 22.
+ ```user``` ssh user. Optional. Default: ```user_<id>``` if an app id is given.
+ ```dst``` a destination path. Optional. Default: ```app_<id>``` if an app id was given.
+ ```files``` an array of files to copy from the dir. Optional. No default.
+ ```sshCmd``` - specify a command to be run remotely after deploy. Overrides any command specified in options.
+ ```skipRsync``` -  Skip deploying files with rsync. Only run ssh-commands, if any.

## Command line options

The following command line options are supported. **Note:** if running deploy as a an npm script, which is the normal way of running it, the deploy options must be preceed by a ```--```. Otherwise the options will be interpreted by ```npm``` which doesn't know what to do with them. Example: ```npm deploy beta -- --dry```

+ ```--dry``` - prints the complete rsync-command that will be executed, but does not execute it
+ ```--rsyncFlags <flags>``` - specify flags to pass to rsync. Default flags are ```avzh```
+ ```--sshCmd <command>``` - specify command to be run remotely after deploy. Overrides any command specified in the config file
+ ```--deployDeps <dep>``` - specify depencies to deploy. Either ```all``` for all dependencies, or the name of a dependency.
+ ```--skipRsync``` - Skip deploying files with rsync. Only run ssh-commands, if any.
+ ```--depsOnly``` - Only deploy dependencies, ignore current directory.
+ ```--help``` - prints command line help summary

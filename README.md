# templ-deploy
Deploy files to Templ (https://templ.io)

## Install
```
npm i -D git@github.com:herman-templio/templ-deploy.git
```

Or, if you're developing this package, simplest is to clone it into a local directory, then to use it in another module:
```
npm i -D path/to/templ-deploy
```

## Config
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

Now:
```
npm run deploy main
```
will deploy the local dir named 'dist' to the given host under the default 'app_1234' directory. 

The config file can contain any number of 'templs' and if none is given on command line, the name of the current branch will be used. So for example:
```
npm run deploy
```
will work provided you're currently in a git repo and the current branch is called 'main'.

## Options
A ```templ``` can contain the following options:

+ ```app``` a templ app id. Optional. No default.
+ ```host``` a hostname. Required.
+ ```port``` ssh port. Optional. Default: 22.
+ ```user``` ssh user. Optional. Default: user_<id> if an app id is given.
+ ```dst``` a destination path. Optional. Default: app_<id> if an app id was given.
+ ```files``` an array of files to copy from the dir. Optional. No default.

import simpleGit, {CleanOptions} from 'simple-git'
import Rsync from 'rsync'
import { SSHCommand } from './ssh.js';
import shelljs from 'shelljs'

const default_options = {
    baseDir: process.cwd(),
    binary: 'git',
    maxConcurrentProcesses: 6,
};

function parseFlags(args,flags) {
    const res={}
    for(let [flag,arg] of Object.entries(flags)) {
        const i = args.indexOf('--'+flag)
        if(i>=0) {
            if(arg) {
                res[flag]=args[i+1]
                args.splice(i,2)
            } else {
                res[flag]=true
                args.splice(i,1)
            }
        }
    }
    return res
}
const flags={
    dry:false,
    rsyncFlags:true,
    ssh_shell:true,
    ssh_cmd:true,
    sshCmd:true,
    deployDeps:true,
    help:false,
    skipMain:false,
    depSsh:true,
    depsOnly:false,
    depsGit:true,
}

function getOpt(opts,dicts,default_val) {
    for(const dict of dicts) {
        for(const opt of opts) {
            if(dict?.[opt]) return dict[opt]
        }
    }
    return default_val
}
function help() {
    console.log('deploy [options] [target]');
    console.log('Deploys code to target based on the config file .templ.mjs.');
    console.log('--dry',"Dry run, don't do anything just print what would be done.")
    console.log('--rsyncFlags',"Extra flags to add to rsync.")
    console.log('--skipRsync',"Skip deploying files with rsync. Only run ssh-commands, if any.")
    console.log('--deployDeps <deps>',"Deploys dependencies specified in config. Argument is either 'all' or a comma-separated list of dependencies to deploy.")
    console.log('--sshCmd',"Command to run remotely after rsync.")
    console.log('--depSsh',"Command to run remotely after deploying dependency.")
    console.log('--depsOnly',"Only deploy dependencies, ignore current directory.")
    console.log('--depsGit <cmd>',"Run git command on deps.")

    console.log('--help',"This info.")
}
export async function deploy({args, options, callback, baseDir,gitOptions=default_options}={}) {
    let config
    args=args||process.argv.slice(2)
    options = options || parseFlags(args,flags)
    console.log(options);
    if(options.help) {
        help(); return
    }
    baseDir=baseDir || gitOptions.baseDir || process.cwd()
    try {
        config = (await import(baseDir+'/.templ.mjs')).default
    } catch(e) {
        console.log('Unable to import config',baseDir+'/.templ.mjs');
        console.log(e.message);
        process.exit(1)
    }

    // console.log(options);
    const git=simpleGit(gitOptions)
    const branch = (await git.branchLocal()).current
    if(options.depsGit) {
        const cmd=options.depsGit.split(' ')
        for (const dep of config.options.deps) {
            //console.log(dep,cmd[0]);
            const dgit=simpleGit(Object.assign(gitOptions,{baseDir:dep}))
            let res
            switch(cmd[0]) {
                case 'status': res=(await dgit.status()).isClean()?'':'modified'; break
                default: break
            }
            if(res) console.log(dep,cmd[0],res);
        }
        return
    }

    console.log('Current branch',branch);
    const templ=args[0]||branch
    const templConfig=config?.templs?.[templ]
    if(!templConfig) {
        console.error('No such templ configured',templ);
        console.error('Available templs are:');
        Object.keys(config?.templs)?.forEach(k=>console.error('   ',k))
        process.exit(1)
    }

    if(!(templConfig.app || templConfig.user) || !templConfig.host) {
        console.log('Config must define an app or user, and a host');
        process.exit(1)
    }

    let shell='ssh'
    if(templConfig.port) shell+=` -p ${templConfig.port}`
    if(templConfig.sshId) shell+=` -i ${templConfig.sshId}`
    const app = templConfig.app
    const dstDir=templConfig.dst?.replace('{{app_dir}}',app) || `app_${app}/`
    const user=templConfig.user||`user_${app}`
    const host=templConfig.host

    options=Object.assign({
        rsyncFlags:templConfig.rsyncFlags||'avzh',
        skipRsync:templConfig.skip_rsync||templConfig.skipRsync,
        callback
    },options)

    if(options.deployDeps && config.options.deps) {
        // Deploy deps first
        for(let dep of config.options.deps) {
            if(options.deployDeps!='all' && !dep.match(options.deployDeps)) continue
            const depBase=baseDir+'/'+dep
            try {
                const dep_options = Object.assign({},config,(await import(depBase+'/.templ.mjs')).default?.options)
                const dstDir=dep_options.dst || dep.replace('../','')
                dep += '/'
                const dir=dep+(dep_options?.dir||'dist')
                const exclude=dep_options?.exclude //?.map(exc=>dep+exc)

                await deploy_dir(options,dir,exclude,shell,dstDir,user,host)
                // Get command from deps config
                let ssh_cmd=getOpt(['ssh_cmd'],[dep_options])
                // Override command from deps config
                ssh_cmd=getOpt(['depSsh','dep_ssh'],[options,config.options])
                if(ssh_cmd) {
                    await deploy_actions(options,ssh_cmd,shell,user,host,dstDir)
                }
            } catch(e) {
                console.error('Failed to deploy dependecy',dep);
                console.error(e.message);
                console.error('Skipping');
            }
        }
    }
    if(options.depsOnly) return

    const dir=templConfig.dir||config.options?.dir||'dist'
    const exclude=templConfig.exclude||config.options?.exclude

    await deploy_dir(options,dir,exclude,shell,dstDir,user,host)
    const ssh_cmd=getOpt(['sshCmd','ssh_cmd','ssh_shell'],[options,templConfig,config.options])
    if(ssh_cmd) {
        await deploy_actions(options,ssh_cmd,shell,user,host,dstDir)
    }
}
/**
 * 
 * @param {object} options 
 * @param {string} dir 
 * @param {[string]} exclude 
 * @param {string} shell 
 * @param {string} dstDir 
 * @param {string} user 
 * @param {string} host 
 * @returns 
 */
export async function deploy_dir(options,dir,exclude,shell,dstDir,user,host) {

    let src=dir
    if(!src.endsWith('/')) src += '/'
    let dst=`${user}@${host}:`
    dst += dstDir
    if(!dst.endsWith('/')) dst += '/'

    console.log('Deploying',dir, 'to', dst);
    if(exclude) console.log('Excluding',exclude);

    const r=Rsync().set('rsync-path',`mkdir -p ${dstDir} && rsync`).shell(shell).exclude(exclude||[]).flags(options.rsyncFlags).source(src).destination(dst)
    if(!options.skipRsync) {
        if(options.dry) {
            console.log( 'Dry run:',r.command() )
        } else {
            let {error,code,cmd}=await new Promise(resolve=>r.execute((error,code,cmd)=>resolve({error,code,cmd})))
            console.log(cmd);
            if(error) {
                console.log('Error',error);
                return
            }
        }
    }
}

/**
 * 
 * @param {object} options 
 * @param {string} ssh_cmd 
 * @param {string} shell 
 * @param {string} user 
 * @param {string} host 
 * @param {string} dstDir 
 */
export async function deploy_actions(options,ssh_cmd,shell,user,host,dstDir) {
    // Run command with SSH via shell
    let cmd=`${shell} ${user}@${host} 'cd ${dstDir}; ${ssh_cmd}'`
    try {
        if(options.dry) {
            console.log('Dry run', cmd);
        } else {
            console.log('Executing',cmd);
            let p = new Promise((r,f)=>{
                const shell =shelljs.exec(cmd,{silent:true},(code,stdout,stderr)=>{
                    r({code,stdout,stderr})
                })
                shell.stdout.on('data', function(data) {
                    /* ... do something with data ... */
                    console.log(data.toString());
                });                      
                shell.stderr.on('data', function(data) {
                    /* ... do something with data ... */
                    console.log('stderr:',data.toString());
                });                      
            })
            let {code,stdout,stderr} = await p
            if(code) {
                console.log('Error code:',code);
            }
        }
    } catch(e) {
        console.log(e);
    }
}

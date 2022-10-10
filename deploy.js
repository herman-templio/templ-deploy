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
    run:true,
    ssh_shell:true,
    help:false,
}

function help() {
    console.log('deploy [options] [target]');
    console.log('Deploys code to target based on the config file .templ.mjs.');
    console.log('--dry',"Dry run, don't do anything just print what would be done.")
    console.log('--rsyncFlags',"Extra flags to add to rsync.")
    console.log('--ssh_shell',"Command to run remotely after rsync.")
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

    const dir=templConfig.dir||config.options?.dir||'dist'
    const exclude=templConfig.exclude||config.options?.exclude

    console.log('Deploying',dir, 'to', 
        templConfig.app||templConfig.user);
    if(exclude) console.log('Excluding',exclude);

    let shell='ssh'
    if(templConfig.port) shell+=` -p ${templConfig.port}`
    if(templConfig.sshId) shell+=` -i ${templConfig.sshId}`
    let src=dir
    if(!src.endsWith('/')) src += '/'
    const app = templConfig.app
    const user=templConfig.user||`user_${app}`
    const host=templConfig.host
    let dst=`${user}@${host}:`
    let dstDir=templConfig.dst || `app_${templConfig.app}/`
    dst+= dstDir
    if(!dst.endsWith('/')) dst += '/'

    const r=Rsync().set('rsync-path',`mkdir -p ${dstDir} && rsync`).shell(shell).exclude(exclude||[]).flags(options.rsyncFlags||templConfig.rsyncFlags||'avzh').source(src).destination(dst)
    const skipRsync=templConfig.skip_rsync||options.skip_rsync
    if(!skipRsync) {
        if(options.dry) {
            console.log( 'Dry run:',r.command() )
        } else {
            if(!callback) callback=(error,code,cmd) => {
                console.log(error,code,cmd);
            }
            let {error,code,cmd}=await new Promise(resolve=>r.execute((error,code,cmd)=>resolve({error,code,cmd})))
            console.log(cmd);
            if(error) {
                console.log('Error',error);
                return
            }
        }
    }
    const run=options.run||templConfig.run||config.options?.run
    if(run) {
        // Run command remotely
        let ssh_dst={host,username:user}
        if(options.dry) ssh_dst.host='mock_ip'
        if(templConfig.port) ssh_dst.port=templConfig.port
        if(templConfig.keyFile) ssh_dst.keyFile=templConfig.keyFile
        let cmd=`cd ${dstDir}; ${run}`
        cmd = new SSHCommand(ssh_dst,cmd)
        try {
            let [code,stdout,stderr] = await cmd.run()
            if(code) {
                console.log('Error code:',code);
            }
            console.log("Stdout:",stdout);
            console.log("Stderr:",stderr);
        } catch(e) {
            console.log(e);
        }
    }
    const ssh_shell=options.ssh_shell||templConfig.ssh_shell||config.options?.ssh_shell
    if(ssh_shell) {
        // Run command with SSH via shell
        let cmd=`${shell} ${user}@${host} 'cd ${dstDir}; ${ssh_shell}'`
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
                //console.log("Stdout:",stdout);
                //console.log("Stderr:",stderr);
            }
        } catch(e) {
            console.log(e);
        }
    }


}

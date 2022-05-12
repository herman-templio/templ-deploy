//ssh.js

import {Client} from 'ssh2';
import fs from 'fs/promises'
//import {delay as wait} from 'app-utils'
//import { Base } from './models/models.js';

const TESTING=process.env.SSH_TESTING
const SSH_USER=process.env.SSH_USER
const SSH_KEYFILE=process.env.SSH_KEYFILE
const SSH_PRIVATEKEY=process.env.SSH_PRIVATEKEY
/**
 * Class SSHCommand
 */
export class SSHCommand {
    debug() {
        if(!this.debug_enabled) return
        console.log(...arguments)
    }
    static keys={}
    /**
     * Constructor
     * The <dest> can be an host address, or an object containing host, username, and optional port and keyfile or key
     * @param {object|string} dest {(ip4|host),[port],username,[keyFile|privateKey]}
     * @param {string} script ssh-command to run
     */
    constructor (dest,script) {
        Object.assign(this,{dest,script})
    }
    /**
     * Fetches private ssh-key. 
     * Checks if the dest contains a key or a keyfile, 
     * if not checks for either environment variable SSH_PRIVATEKEY and SSH_KEYFILE.
     * If the key was fetcted from file, it is stored in memory for subsequent fetchtes.
     * @returns string private ssh-key
     */
    async getKey() {
        if(this.dest.privateKey) return this.dest.privateKey
        let file=this.dest.keyFile
        if(!file) {
            if(SSH_PRIVATEKEY) return SSH_PRIVATEKEY
            file=SSH_KEYFILE
        }
        if(!file) return
        if(!this.constructor.keys?.[file]) {
            this.constructor.keys[file]=(await fs.readFile(file)).toString()
        }
        return this.constructor.keys[file]
    }
    /**
     * Runs the command on the ssh destination
     * @returns [code,stdout,sterr]
     */
    async run() {
        let rcmd=this.script
        if(rcmd.cmd) rcmd=rcmd.cmd
        let host = this.dest
        if(host.ip4) host=host.ip4
        if(host.host) host=host.host
        if ( !host || host=='mock_ip' || TESTING) {
            // Should we assume that we're testing?
            console.log("Not executed: ",rcmd);
            this.result=[0,'','Not executed: '+rcmd]
            return this.result
        }
        const port=this.dest?.port || 22
        let user = this.dest?.username || SSH_USER
        var retry=5
        var delay=2
        let code,stdout,stderr

        while(retry>0) {
            try {
                [code, stdout, stderr] = await this.callSSH(host,port,user,rcmd,await this.getKey())
                if(code) {
                    //console.log('Checking ssh');
                    if (
                        /ssh_exchange_identification: read: Connection reset by peer/.test(stderr) ||
                        (/ssh: connect to host [0-9.]* port 22: Connection refused/.test(stderr)) ||
                        (/^SSH2 connection failed: connect ECONNREFUSED/.test(stderr))
                    ) {
                        // if connection refused, try again
                        retry -= 1
                        delay=delay*2
                        console.log('SSH not connecting, retrying in',delay,'seconds');
                        await wait(delay*1000)
                        continue
                    }
                }
                retry=0
                if (code && ! stderr) {
                    stderr='unknown error'
                    console.log('SSH ERROR: Failed without stderr:', rcmd)
                }
                stderr=stderr.replace(/Warning: Permanently added '[0-9.]+' .*(\r\n|\n|\r)/,'')
                if (code) {
                    console.log('ssh failed and no retry', stderr);
                }
            } catch(e) {
                code=1
                stderr=e.message
                retry=0
            }
        }
        return [code,stdout,stderr]
    }
    /**
     * Execute command via ssh
     * @param {string} host ip or address
     * @param {numberOrString} port ssh-port
     * @param {string} username username
     * @param {string} rcmd command to execute
     * @param {string} privateKey private key
     * @returns 
     */
    async callSSH(host,port,username,rcmd,privateKey) {
        this.debug('Calling',host,port,username,rcmd)
        return new Promise((resolve)=> {
            try {
                var conn = new Client();
                conn.on('ready', function() {
                    conn.exec(rcmd, function(err, stream) {
                        if (err) return resolve([1,stdout,`Execution failed: ${err.message}`]);
                        let stdout='',stderr=''
                        stream.on('close', function(code, signal) {
                            //console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
                            conn.end();
                            if(code) console.log('ssh2 failed',stderr,stdout);
                            resolve([code,stdout,stderr])
                        }).on('data', function(data) {
                            stdout += data
                        }).stderr.on('data', function(data) {
                            //console.log('STDERR: ' + data);
                            stderr += data
                        });
                    });
                }).on('error',(err)=>{
                    resolve([1,'',`SSH2 connection failed: ${err.message}`])
                }).connect({
                    host: host,
                    port: port,
                    username,
                    privateKey
                });
            } catch (e) {
                console.log('Unable to connect');
                next(1,"",e.message)
            }
        })
    }
}
const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock, GoalXZ, GoalNear, GoalGetToBlock, GoalFollow } = require('mineflayer-pathfinder').goals;
const autoeat = require('mineflayer-auto-eat').plugin;
const armorManager = require('mineflayer-armor-manager');
const webinventory = require('mineflayer-web-inventory');
const pvp = require('mineflayer-pvp').plugin;
const { Vec3 } = require('vec3')
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const config = require('./settings.json');
const express = require('express');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot Is Ready')
});

app.listen(3000, () => {
  console.log('Server started');
});


function createBot() {
   let server = config.server.ip
   let ip = server.split(':')

   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      password: config['bot-account']['password'],
      auth: config['bot-account']['type'],
      host: ip[0],
      port: ip[1],
      version: config.server.version,
   });

   bot.on('login', () => {
    bot.loadPlugin(pathfinder);
    bot.loadPlugin(pvp);
    const mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.settings.colorsEnabled = false;
    bot.pathfinder.setMovements(defaultMove);

      bot.once('spawn', () => {
         log("Bot joined to the server");
         process.title = `${bot.username} @ ${server}`

         if (config.utils['auto-auth'].enabled) {
            log('Started auto-auth module');

            let password = config.utils['auto-auth'].password;
            setTimeout(() => {
               bot.chat(`/register ${password} ${password}`);
               bot.chat(`/login ${password}`);
            }, 500);

            log(`Authentication commands executed`);
         }

         if (config.utils['chat-messages'].enabled) {
            log('Started chat-messages module');

            let messages = config.utils['chat-messages']['messages'];

            if (config.utils['chat-messages'].repeat) {
               let delay = config.utils['chat-messages']['repeat-delay'];
               let i = 0;

               setInterval(() => {
                  bot.chat(`${messages[i]}`);

                  if (i + 1 === messages.length) {
                     i = 0;
                  } else i++;
               }, delay * 1000);
            } else {
               messages.forEach((msg) => {
                  bot.chat(msg);
               });
            }
         }

         const pos = config.position;

         if (config.position.enabled) {
            log(`Starting moving to target location (${pos.x}, ${pos.y}, ${pos.z})`);
            bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));

            bot.on('goal_reached', () => {
               log(`Bot arrived to target location. ${bot.entity.position}`);
            })
         }

         if (config.utils['anti-afk'].enabled) {
            if (config.utils['anti-afk'].sneak) {
               bot.setControlState('sneak', true);
            }

            if (config.utils['anti-afk'].jump) {
               bot.setControlState('jump', true);
            }

            if (config.utils['anti-afk']['hit'].enabled) {
               let delay = config.utils['anti-afk']['hit']['delay'];
               let attackMobs = config.utils['anti-afk']['hit']['attack-mobs']

               setInterval(() => {
                  if(attackMobs) {
                        let entity = bot.nearestEntity(e => e.type !== 'object' && e.type !== 'player'
                            && e.type !== 'global' && e.type !== 'orb' && e.type !== 'other');

                        if(entity) {
                           bot.attack(entity);
                           return
                        }
                  }

                  bot.swingArm("right", true);
               }, delay);
            }

            if (config.utils['anti-afk'].rotate) {
               setInterval(() => {
                  bot.look(bot.entity.yaw + 1, bot.entity.pitch, true);
               }, 100);
            }

            if (config.utils['anti-afk'].walk.enabled) {
               
               bot.on('death', () => {
               })
               switch(config.utils['anti-afk'].walk.selected) {
                  case 'rhombus':
                     const rhombusradius = config.utils['anti-afk'].walk.mode.rhombus.radius
                     rhombuswalk(bot, rhombusradius)
                     break

                  case 'square':
                     const squareradius = config.utils['anti-afk'].walk.mode.square.radius
                     squarewalk(bot, squareradius)
                     break

                  case 'circle':
                     const center = bot.entity.position.clone()
                     const circleradius = config.utils['anti-afk'].walk.mode.circle.radius
                     const speed = 2 * Math.PI / (circleradius * 20)
                     let theta = 0

                     bot.on('physicTick', () => {
                        theta += speed
                        const x = center.x + circleradius * Math.cos(theta)
                        const z = center.z + circleradius * Math.sin(theta)
                        const y = bot.entity.position.y
                        const target = new Vec3(x, y, z)
                        bot.lookAt(target)
                        bot.setControlState('forward', true)
                     })
                     break

                  case 'random':
                     startAFK()
                     function startAFK() {
                        setTimeout(() => {
                           const direction = Math.floor(Math.random() * 5);
                              switch (direction) {
                                 case 0:
                                    bot.setControlState('forward', true);
                                    break;
                                 case 1:
                                    bot.setControlState('back', true);
                                    break;
                                 case 2:
                                    bot.setControlState('left', true);
                                    break;
                                 case 3:
                                    bot.setControlState('right', true);
                                    break;
                                 case 4:
                                    bot.setControlState('jump', true);
                                    setTimeout(() => bot.setControlState('jump', false), 250);
                                    break;
                              }
                           startAFK();
                        }, config.utils['anti-afk'].walk.mode.random.time);
                     }
                     break

                  default:
                     log(`Unknow mode: ${config.utils['anti-afk'].walk.selected}`)
                     break
               }
            }
         }
      })

      if (config.utils['auto-eat'].enabled) {
         bot.loadPlugin(autoeat)
         bot.autoEat.options.priority = 'foodPoints';
         bot.autoEat.options.startAt = config.utils['auto-eat']['eat-at'];
         bot.autoEat.options.bannedFood.push(...config.utils['auto-eat']['no-eat']);
      }

      if (config.utils.webinv.enabled) {
         let invoptions = {
            port: config.utils.webinv.port
         }
        
         webinventory(bot, invoptions)
      }

      if (config.utils['auto-sleep']) {
         bot.on('rain', () => {
            if (bot.isSleeping) return
            log(`It's raining`)
            sleep()
         })

         bot.on('time', () => {
            if (bot.isSleeping) return
            const isNight = bot.time.timeOfDay > 13000
            if (isNight) {
               log(`It's night`)
               sleep()
            }
         })
      }
      
      if (config.pvp['auto-totem'].enabled) {
         bot.loadPlugin(autototem)
         bot.on("physicsTick", async () => {
            bot.autototem.equip()
        })
      }

      if (config.pvp['auto-armor']) {
         bot.loadPlugin(armorManager);
         bot.armorManager.equipAll()
      }
   });

   function sleep () {
      const bed = bot.findBlock({
         matching: block => bot.isABed(block)
      })
      if (!bed) {
         log(`I can't see any bed`)
         return
      }
      bot.pathfinder.setGoal(new GoalGetToBlock(bed.position.x, bed.position.y, bed.position.z))
      bot.once('goal_reached', () => {
         bot.pathfinder.setGoal(null)
         bot.sleep(bed, (err) => {
            if (err) {
               log(`Bot can't sleep because ${err.message}`)
            } else {
               log('Bot sleep')
            }
         })
      })
   }
   
   rl.on('line', (input) => {
      if (config.utils['console-chat']) {
         bot.chat(input)
      }
   });

   bot.on('autoeat_error', (error) => {
      berror(error)
   });

   bot.on('autoeat_finished', (item, offhand) => {
      log(`[AutoEat] Finished eating ${item.name} in ${offhand ? 'offhand' : 'hand'}`)
   });

   bot.on('spawn', () => {
      if (config.guard.enabled) {
         bot.pathfinder.setGoal(null)
         const guardpos = config.guard.position
         const mcData = require('minecraft-data')(bot.version)
         const movements = new Movements(bot, mcData)
         movements.scafoldingBlocks = ['stone', 'cobblestone', 'dirt']
         bot.on("physicsTick", () => {
            const botpos = bot.entity.position
            const botposroundingx = Math.floor(botpos.x)
            const botposroundingy = Math.floor(botpos.y)
            const botposroundingz = Math.floor(botpos.z)
            const guardposroundingx = Math.floor(guardpos.x)
            const guardposroundingy = Math.floor(guardpos.y)
            const guardposroundingz = Math.floor(guardpos.z)
            const filter = e => (e.type === 'mob' || e.type === 'player') && e.position.distanceTo(bot.entity.position) < 10 && e.mobType !== 'Armor Stand' && e !== bot.players['quangei'].entity
            const target = bot.nearestEntity(filter)
            if (!target) {
               if (botposroundingx !== guardposroundingx || botposroundingy !== guardposroundingy || botposroundingz !== guardposroundingz) {
                  if (bot.pathfinder.isMoving()) return
                  if (bot.pvp.target) return
                  bot.pathfinder.setGoal(new GoalBlock(guardpos.x, guardpos.y, guardpos.z))
                  bot.pvp.stop()
               }
            } else if (target) {
               bot.pathfinder.setGoal(new GoalFollow(target, 2), true)
               if (bot.pathfinder.isMoving()) return
               const sword = bot.inventory.items().find(item => item.name.includes('sword'))
               if (sword) {bot.equip(sword, 'hand')}
               bot.pvp.attack(target)
            }}
         )
      }
   })

   bot.on('message', (message, position) => {
      if (position == 'game_info') return
      if (config.utils['mes-log']) {
         log(message.toAnsi());
      }
   });

   bot.on('death', () => {
      warn(`Bot has been died and was respawned at ${bot.entity.position}`);
      if(config.utils['respawn-chat'].enabled)
      bot.once('spawn', () => {
         const chat = config.utils['respawn-chat'].chat;
         const delay = config.utils['respawn-chat'].delay;

         for (let i = 0; i < chat.length; i++) {
         setTimeout(() => {
            bot.chat(chat[i]);
         }, i * delay);
         }
      });
   })
    

   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         setTimeout(() => {
            createBot();
         }, config.utils['auto-reconnect-delay']);
      });
   }

   bot.on('kicked', (reason) => {
      let reasonText = JSON.parse(reason).text;
      if(reasonText === '') {
         reasonText = JSON.parse(reason).extra[0].text
      }
      reasonText = reasonText.replace(/§./g, '');

      warn(`Bot was kicked from the server. Reason: ${reasonText}`)
   }
   );

   bot.on('error', (err) =>
      berror(`${err.message}`)
   );
}

function rhombuswalk(bot, radius) {
   return new Promise(() => {
      const pos = bot.entity.position;
      const x = pos.x;
      const y = pos.y;
      const z = pos.z;

      const points = [
         [x + radius, y, z],
         [x, y, z + radius],
         [x - radius, y, z],
         [x, y, z - radius],
      ];

      let i = 0;
      setInterval(() => {
         if(i === points.length) i = 0;
         bot.pathfinder.setGoal(new GoalXZ(points[i][0], points[i][2]));
         i++;
      }, 1000);
   });
}

function squarewalk(bot, radius) {
   return new Promise(() => {
      const pos = bot.entity.position;
      const x = pos.x;
      const y = pos.y;
      const z = pos.z;

      const points = [
         [x + radius, y, z],
         [x + radius, y, z + radius],
         [x, y, z + radius],
         [x, y, z]
      ];

      let i = 0;
      setInterval(() => {
         if(i === points.length) i = 0;
         bot.pathfinder.setGoal(new GoalXZ(points[i][0], points[i][2]));
         i++;
      }, 1000);
   });
}

createBot();

const now = new Date()
const time = now.toLocaleString().replace("," , "-").replace(" " , "")

function log(input) {
   console.log(`\r\x1b[38;2;11;252;3m [${config.server.ip}] [${time}] [INFO] >>>\x1b[0m ${input}`)
   rl.prompt(true)
}

function warn(input) {
   console.warn(`\r\x1b[38;2;255;238;5m [${config.server.ip}] [${time}] [WARN] >>> ${input}\x1b[0m`)
   rl.prompt(true)
}

function berror(input) {
   console.error(`\r\x1b[38;2;255;5;5m [${config.server.ip}] [${time}] [ERROR] >>> ${input}\x1b[0m`)
   rl.prompt(true)
}




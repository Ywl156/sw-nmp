#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ping from 'node-http-ping';

import { exec, execSync } from 'node:child_process';
import path from 'node:path';

import { absolutePath, readJsonFileSync, writeJsonFileSync } from './utils.js';

const version = readJsonFileSync(path.join(absolutePath.dirname(import.meta.url), '../package.json')).version;
const registriesPath = path.join(absolutePath.dirname(import.meta.url), './registries.json');
const registries = readJsonFileSync(registriesPath);

program.version(version);

const whiteList = ['npm', 'cnpm', 'yarn', 'taobao', 'tencent', 'huawei', 'npmMirror'];

const getCurrData = async () => {
  const registry = await execSync('npm get registry', { encoding: 'utf-8' });
  const f = Object.keys(registries).find(name => {
    if (registries[name].registry === registry.trim()) return true;
  });
  return {
    name: f ? f : '',
    registry: registry.trim(),
  };
};

const printCurr = async ({ name, registry }) => {
  console.log(chalk.blue('当前镜像源: ') + (name ? chalk.white(name) + chalk.green(' (' + registry + ')') : chalk.green('registry')));
};

program
  .command('ls')
  .description('查看镜像源列表')
  .action(async () => {
    const currData = await getCurrData();
    console.log(chalk.blue('当前镜像源: ') + chalk.green(currData.registry));

    Object.keys(registries).forEach(name => {
      if (registries[name].registry === currData.registry) {
        console.log(chalk.blue('*' + name) + ' (' + chalk.green(registries[name].registry) + ')\n');
      } else {
        console.log(chalk.white(name) + ' (' + chalk.green(registries[name].registry) + ')\n');
      }
    });
  });

program
  .command('curr')
  .description('查看当前镜像源')
  .action(async () => {
    const currData = await getCurrData();
    printCurr(currData);
  });

const switchReg = (currData, sel, reg) => {
  return new Promise((resolve, reject) => {
    const registry = registries[sel] ? registries[sel].registry : reg;
    console.log(chalk.white('切换中...'));
    exec(`npm config set registry ${registry}`, null, async err => {
      if (err) {
        console.log(chalk.red('切换失败'));
        reject(false);
      }

      const newData = await getCurrData();
      if ((newData.name === 'npm' && sel === 'npm') || (newData.name !== 'npm' && newData.name !== currData.name)) {
        console.log(chalk.green('切换成功'));
        resolve(true);
      } else {
        console.log(chalk.red('切换失败'));
        printCurr(newData);
        reject(false);
      }
    });
  });
};

program
  .command('use')
  .description('切换镜像源')
  .action(async () => {
    const currData = await getCurrData();
    printCurr(currData);

    inquirer
      .prompt([
        {
          type: 'list',
          name: 'sel',
          message: '请选择镜像源',
          choices: Object.keys(registries).filter(key => key !== currData.name),
        },
      ])
      .then(result => {
        switchReg(currData, result.sel);
      });
  });

program
  .command('add')
  .description('添加自定义镜像源')
  .action(async () => {
    inquirer
      .prompt([
        {
          type: 'input',
          name: 'name',
          message: '请输入镜像源名称',
          validate: value => {
            if (Object.keys(registries).includes(value)) {
              return '镜像源名称已存在';
            }
            if (!value.trim()) {
              return '镜像源名称不能为空';
            }
            return true;
          },
        },
        {
          type: 'input',
          name: 'registry',
          message: '请输入镜像源地址',
          validate: value => {
            if (!value.trim()) {
              return '镜像源地址不能为空';
            }
            return true;
          },
        },
      ])
      .then(result => {
        const del = url => {
          return url[url.length - 1] === '/' ? url.substring(0, url.length - 1) : url;
        };
        const registry = result.registry.trim();

        registries[result.name] = {
          home: registry,
          registry,
          ping: del(registry),
        };
        try {
          console.log(chalk.white('正在添加...'));
          writeJsonFileSync(registriesPath, registries);
          console.log(chalk.green('添加完成'));
        } catch (e) {
          console.log(chalk.red(e));
        }
      });
  });

program
  .command('del')
  .description('删除自定义镜像源')
  .action(() => {
    const keys = Object.keys(registries);
    if (keys <= whiteList.length) {
      return console.log(chalk.red('当前无自定义源可删除'));
    } else {
      inquirer
        .prompt([
          {
            type: 'list',
            name: 'name',
            message: '请选择要删除的镜像源',
            choices: keys.filter(key => !whiteList.includes(key)),
          },
        ])
        .then(async result => {
          const currData = await getCurrData();
          if (result.name === currData.name) {
            return console.log(chalk.red('当前镜像源正在使用，无法删除'));
          } else {
            try {
              console.log(chalk.white('正在删除...'));
              delete registries[result.name];
              writeJsonFileSync(registriesPath, registries);
              console.log(chalk.green('删除完成'));
            } catch (e) {
              console.log(chalk.red(e));
            }
          }
        });
    }
  });

program
  .command('edit')
  .description('编辑自定义镜像源')
  .action(async () => {
    const keys = Object.keys(registries);
    if (keys <= whiteList.length) {
      return console.log(chalk.red('当前无自定义源可编辑'));
    } else {
      const { name } = await inquirer.prompt([
        {
          type: 'list',
          name: 'name',
          message: '请选择要编辑的镜像源',
          choices: keys.filter(key => !whiteList.includes(key)),
        },
      ]);

      const { registerUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'registerUrl',
          message: '请输入新的镜像源地址',
          validate(registerUrl) {
            if (!registerUrl.trim()) {
              return '镜像地址不能为空';
            }
            return true;
          },
        },
      ]);

      const editFn = () => {
        const del = url => {
          return url[url.length - 1] === '/' ? url.substring(0, url.length - 1) : url;
        };
        const registry = registerUrl.trim();

        registries[name] = {
          home: registry,
          registry,
          ping: del(registry),
        };
        try {
          console.log(chalk.white('正在编辑...'));
          writeJsonFileSync(registriesPath, registries);
          console.log(chalk.green('编辑成功'));
        } catch (e) {
          console.log(chalk.red(e));
        }
      };

      const currData = await getCurrData();
      if (name === currData.name) {
        console.log(chalk.white('当前镜像源正在使用，正在切换新源...'));
        const isSwitch = await switchReg(currData, '', registerUrl);
        if (isSwitch) {
          editFn();
        } else {
          console.log(chalk.red('编辑失败'));
        }
      } else {
        editFn();
      }
    }
  });

program
  .command('rename')
  .description('重命名镜像源')
  .action(() => {
    const keys = Object.keys(registries);
    inquirer
      .prompt([
        {
          type: 'list',
          name: 'sel',
          message: '请选择镜像源',
          choices: keys.filter(key => !whiteList.includes(key)),
        },
        {
          type: 'input',
          name: 'newName',
          message: '新的镜像源名称',
          validate(newName) {
            if (keys.includes(newName)) {
              return '镜像源名称已存在';
            }
            if (!newName.trim()) {
              return '镜像源名称不能为空';
            }
            return true;
          },
        },
      ])
      .then(result => {
        console.log(chalk.white('正在重命名镜像源...'));
        registries[result.newName] = registries[result.sel];
        delete registries[result.sel];
        try {
          writeJsonFileSync(registriesPath, registries);
          console.log(chalk.green('重命名成功'));
        } catch (e) {
          console.log(chalk.red(e));
        }
      });
  });

program
  .command('ping')
  .description('测试镜像地址速度')
  .action(() => {
    const keys = Object.keys(registries);
    inquirer
      .prompt([
        {
          type: 'list',
          name: 'sel',
          message: '请选择镜像源',
          choices: keys,
        },
      ])
      .then(result => {
        console.log(chalk.white('正在测试镜像源...'));
        ping(registries[result.sel].ping)
          .then(time => {
            console.log(chalk.blue(`响应时长：${time}ms`));
          })
          .catch(e => {
            console.log(chalk.red(e));
          });
      });
  });

program.parse(process.argv);

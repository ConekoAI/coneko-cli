const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const QRCode = require('qrcode');
const Jimp = require('jimp');
const jsQR = require('jsqr');
const msgpack = require('msgpack-lite');

const { getFingerprint } = require('../lib/crypto');

const CONeko_DIR = path.join(require('os').homedir(), '.coneko');
const KEYS_FILE = path.join(CONeko_DIR, 'keys.json');
const CONTACTS_FILE = path.join(CONeko_DIR, 'contacts.json');
const PERMISSIONS_FILE = path.join(CONeko_DIR, 'permissions.json');

async function qrShow(options) {
  const spinner = ora('Generating QR code...').start();
  
  try {
    if (!await fs.pathExists(KEYS_FILE)) {
      spinner.fail('Agent not initialized. Run: coneko init');
      return;
    }
    
    const keys = await fs.readJson(KEYS_FILE);
    
    const qrData = {
      v: 'coneko-1',
      id: keys.agentId,
      fp: keys.fingerprint,
      pk: keys.keys.encryptionPublic,
      name: keys.name,
      relay: keys.relay
    };
    
    const packed = msgpack.encode(qrData);
    const b64 = Buffer.from(packed).toString('base64');
    
    if (options.output) {
      await QRCode.toFile(options.output, b64, {
        type: 'png',
        width: 400,
        margin: 2
      });
      spinner.succeed(`QR code saved to: ${options.output}`);
    } else {
      const terminalQR = await QRCode.toString(b64, { type: 'terminal', small: true });
      spinner.succeed('QR Code:');
      console.log(terminalQR);
      console.log(chalk.gray('\nTip: Use -o to save to file'));
    }
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function qrScan(imagePath, options) {
  const spinner = ora('Scanning QR code...').start();
  
  try {
    if (!await fs.pathExists(KEYS_FILE)) {
      spinner.fail('Agent not initialized. Run: coneko init');
      return;
    }
    
    const image = await Jimp.read(imagePath);
    const code = jsQR(
      new Uint8ClampedArray(image.bitmap.data),
      image.bitmap.width,
      image.bitmap.height
    );
    
    if (!code) {
      spinner.fail('No QR code found in image');
      return;
    }
    
    const packed = Buffer.from(code.data, 'base64');
    const qrData = msgpack.decode(packed);
    
    spinner.succeed('QR code detected');
    console.log(chalk.bold('\nAgent:'));
    console.log(`  Name: ${qrData.name}`);
    console.log(`  ID: ${qrData.id}`);
    console.log(`  Fingerprint: ${qrData.fp}`);
    console.log(`  Relay: ${qrData.relay}`);
    
    // Verify fingerprint
    const computedFp = getFingerprint(qrData.pk);
    if (computedFp !== qrData.fp) {
      console.log(chalk.red('\n⚠ Fingerprint mismatch!'));
      console.log(chalk.red(`  Computed: ${computedFp}`));
      return;
    }
    console.log(chalk.green('\n✓ Fingerprint verified'));
    
    // Confirm
    const inquirer = require('inquirer');
    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Add this contact? (Verify identity out-of-band first!)',
      default: false
    }]);
    
    if (!confirm) {
      console.log(chalk.yellow('Contact not added'));
      return;
    }
    
    // Add contact
    const contacts = await fs.readJson(CONTACTS_FILE);
    const permissions = await fs.readJson(PERMISSIONS_FILE);
    const contactName = options.name || qrData.name;
    
    contacts.contacts[qrData.fp] = {
      agentId: qrData.id,
      name: contactName,
      publicKey: qrData.pk,
      relay: qrData.relay,
      trusted: true,
      added: new Date().toISOString()
    };
    
    permissions.contacts[qrData.fp] = {
      name: contactName,
      permissions: []
    };
    
    await fs.writeJson(CONTACTS_FILE, contacts, { spaces: 2 });
    await fs.writeJson(PERMISSIONS_FILE, permissions, { spaces: 2 });
    
    console.log(chalk.green(`\n✓ Contact added: ${contactName}`));
    
  } catch (err) {
    spinner.fail(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function list() {
  try {
    if (!await fs.pathExists(CONTACTS_FILE)) {
      console.log(chalk.yellow('No contacts file'));
      return;
    }
    
    const contacts = await fs.readJson(CONTACTS_FILE);
    const list = Object.entries(contacts.contacts || {});
    
    if (list.length === 0) {
      console.log(chalk.yellow('No contacts yet'));
      return;
    }
    
    console.log(chalk.bold('\nContacts:'));
    console.log(`${'Fingerprint'.padEnd(20)} ${'Name'.padEnd(20)} Status`);
    console.log('-'.repeat(60));
    
    for (const [fp, info] of list) {
      const status = info.trusted ? chalk.green('trusted') : chalk.red('blocked');
      console.log(`${fp.padEnd(20)} ${info.name.padEnd(20)} ${status}`);
    }
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

async function block(fingerprint) {
  try {
    if (!await fs.pathExists(CONTACTS_FILE)) {
      console.log(chalk.yellow('No contacts file'));
      return;
    }
    
    const contacts = await fs.readJson(CONTACTS_FILE);
    
    if (!contacts.contacts[fingerprint]) {
      console.log(chalk.yellow(`Contact not found: ${fingerprint}`));
      return;
    }
    
    contacts.contacts[fingerprint].trusted = false;
    contacts.contacts[fingerprint].blocked = true;
    
    await fs.writeJson(CONTACTS_FILE, contacts, { spaces: 2 });
    console.log(chalk.green(`✓ Contact blocked: ${fingerprint}`));
    
  } catch (err) {
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  }
}

module.exports = { qrShow, qrScan, list, block };

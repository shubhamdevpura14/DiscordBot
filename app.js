'use strict';

const electron = require("electron");
const bot = require("./src/bot")();

const {app, BrowserWindow, Menu, dialog, ipcMain} = electron;
app.allowRendererProcessReuse = true;

let menu = [
	{
		label: 'Edit',
		submenu: [
			{role: 'undo'},
			{role: 'redo', accelerator: 'CmdOrCtrl+R'},
			{type: 'separator'},
			{role: 'cut'},
			{role: 'copy'},
			{role: 'paste'},
			{role: 'pasteandmatchstyle'},
			{role: 'delete'},
			{role: 'selectall'}
		]
	},
	{
		label: 'View',
		submenu: [
			{role: 'zoomin', accelerator: 'CmdOrCtrl+='},
			{role: 'zoomout', accelerator: 'CmdOrCtrl+-'},
			{role: 'resetZoom'},
			{role: 'togglefullscreen'}
		].concat(
			// Enable dev tools only in dev mode
			process.argv.includes('dev') ? [{role: 'toggleDevTools'}] : []
		)
	},
	{
		role: 'Window',
		submenu: [
			{role: 'minimize'},
			{role: 'close'}
		]
	}
];
Menu.setApplicationMenu(Menu.buildFromTemplate(menu));

let mainWindow;
app.on('ready', () => {
	mainWindow = new BrowserWindow({
		webPreferences: {
			nodeIntegration: true,
			enableRemoteModule: false
		}
	});
	mainWindow.setMenuBarVisibility(false);
	mainWindow.setAutoHideMenuBar(true);
	mainWindow.loadURL("file://" + __dirname + "/app.html");
	mainWindow.on('focus', () => {
		let contents = mainWindow.webContents;
	});
	ipcMain.handle('folder-prompt', async (event, title) => {
		const options = {
			title: title,
			properties: ["openDirectory"]
		};
		let box = await dialog.showOpenDialog(options);
		return box.filePaths[0];
	});
	ipcMain.handle('save-excel', async (event, fileName) => {
		const options = {
			filters: [
				{name: "Excel Workbook", extensions: ["xlsx"]},
				{name: 'All Files', extensions: ['*']},
			],
			title: "Save backup",
			defaultPath: fileName
		};
		let box = await dialog.showSaveDialog(options);
		return box.filePath;
	});
	ipcMain.on('logout', async event => {
		try {
			bot.destroy();
			app.relaunch();
			app.exit();
			event.returnValue = true;
		} catch (err) {
			event.returnValue = false;
		}
	});
});
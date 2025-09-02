const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');

function driveAuth(accessToken: string) {
    const auth = new OAuth2Client({});
    auth.setCredentials({ access_token: accessToken })
    const service = google.drive({ version: 'v3', auth: auth });
    return service;
}

class DriveHelper {
    private _accessToken: string;

    public constructor(accessToken: string) {
        this._accessToken = accessToken;
    }

    public async listFiles() {
        const service = driveAuth(this._accessToken);
        try {
            const res = await service.files.list({
                spaces: 'appDataFolder',
                fields: 'nextPageToken, files(id, name)',
                pageSize: 100,
            });
            return res.data.files;
        } catch (err) {
            // TODO(developer) - Handle error
            return err;
        }
    }

}

export default DriveHelper;

// // Request to list all files
// app.get('/projects/:token', (req, res) => {
//     let accessToken = req.params.token;
//     listFiles(accessToken).then((response) => {
//         res.send(response)
//     })
// })

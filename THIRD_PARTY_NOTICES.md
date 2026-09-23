# Third-party notices

Mdfy is licensed under MIT. Its HEIC-to-JPEG conversion includes the following
LGPL-licensed software in the bundled `main.js`:

| Component | Version | License | Source |
| --- | --- | --- | --- |
| heic-to | 1.5.2 | LGPL-3.0-or-later | [v1.5.2](https://github.com/hoppergee/heic-to/tree/v1.5.2) |
| libheif | 1.22.2 | LGPL-3.0 | [v1.22.2](https://github.com/strukturag/libheif/tree/v1.22.2) |
| libde265 | 1.0.16 | LGPL-3.0 | [v1.0.16](https://github.com/strukturag/libde265/tree/v1.0.16) |

Copies of the [LGPLv3](licenses/heic-to-LGPL-3.0.txt) and
[GPLv3](licenses/GPL-3.0.txt) are included in this repository and embedded,
along with this notice and Mdfy's MIT license, at the top of the distributed
`main.js`. The matching GitHub release also provides the exact upstream source
archives for the decoder components, alongside Mdfy's source archive.

To rebuild Mdfy with a modified decoder, check out the matching Mdfy release
tag, run `npm ci`, then install your rebuilt `heic-to` package with
`npm install --no-save --package-lock=false /path/to/modified/heic-to` and run
`npm run build`. The resulting `main.js` can replace the installed plugin's
`main.js`; no additional decoder file is needed. To change the bundled C/C++
decoder, follow the build instructions in the corresponding `heic-to` and
`libheif` source archives first.

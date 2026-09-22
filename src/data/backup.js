/**
 * 原稿バックアップ・.txtダウンロード・ネイティブZIP圧縮・一括エクスポート
 */
import { getStoryPlainText } from '../utils/text.js';
import { d, f, g, s, flushPendingHeavyTask } from './storage.js';

export function downloadTextFile(filename, text) {
    // BOM（\uFEFF）を先頭に付与したUTF-8形式で保存
    // Windowsのメモ帳やWord、各種エディタでの文字コード自動判別ミス（Shift_JIS誤認による文字化け）を確実に防止
    let contentWithBom = (typeof text === 'string' && !text.startsWith('\uFEFF')) ? ('\uFEFF' + text) : text;
    let blob = new Blob([contentWithBom], { type: 'text/plain;charset=utf-8' });
    downloadBlobFile(filename, blob);
}

export function downloadBlobFile(filename, blob) {
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/* 純粋なJavaScriptによるZIP圧縮ファイルの生成（外部ライブラリ不要・UTF-8対応） */
export function createZipBlob(files) {
    function makeCrcTable() {
        let c, table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) {
                c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            table[n] = c;
        }
        return table;
    }
    const crcTable = makeCrcTable();
    function calcCrc32(bytes) {
        let crc = 0 ^ (-1);
        for (let i = 0; i < bytes.length; i++) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
        }
        return (crc ^ (-1)) >>> 0;
    }

    const encoder = new TextEncoder();
    let now = new Date();
    let dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
    let dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

    let localHeadersAndData = [];
    let centralDirHeaders = [];
    let currentOffset = 0;

    files.forEach(file => {
        let contentWithBom = (typeof file.content === 'string' && !file.content.startsWith('\uFEFF'))
            ? ('\uFEFF' + file.content)
            : file.content;
        let nameBytes = encoder.encode(file.name);
        let dataBytes = encoder.encode(contentWithBom);
        let crc = calcCrc32(dataBytes);
        let size = dataBytes.length;

        // Local file header (30 bytes)
        let localHeader = new Uint8Array(30);
        let lView = new DataView(localHeader.buffer);
        lView.setUint32(0, 0x04034b50, true); // signature
        lView.setUint16(4, 20, true);         // version needed
        lView.setUint16(6, 0x0800, true);     // flags (bit 11: UTF-8)
        lView.setUint16(8, 0, true);          // compression (0 = stored)
        lView.setUint16(10, dosTime, true);
        lView.setUint16(12, dosDate, true);
        lView.setUint32(14, crc, true);
        lView.setUint32(18, size, true);       // compressed size
        lView.setUint32(22, size, true);       // uncompressed size
        lView.setUint16(26, nameBytes.length, true);
        lView.setUint16(28, 0, true);          // extra field length

        localHeadersAndData.push(localHeader, nameBytes, dataBytes);

        // Central directory file header (46 bytes)
        let centralHeader = new Uint8Array(46);
        let cView = new DataView(centralHeader.buffer);
        cView.setUint32(0, 0x02014b50, true); // signature
        cView.setUint16(4, 20, true);         // version made by
        cView.setUint16(6, 20, true);         // version needed
        cView.setUint16(8, 0x0800, true);     // flags (UTF-8)
        cView.setUint16(10, 0, true);         // compression
        cView.setUint16(12, dosTime, true);
        cView.setUint16(14, dosDate, true);
        cView.setUint32(16, crc, true);
        cView.setUint32(20, size, true);
        cView.setUint32(24, size, true);
        cView.setUint16(28, nameBytes.length, true);
        cView.setUint16(30, 0, true);         // extra field length
        cView.setUint16(32, 0, true);         // comment length
        cView.setUint16(34, 0, true);         // disk number start
        cView.setUint16(36, 0, true);         // internal attributes
        cView.setUint32(38, 0, true);         // external attributes
        cView.setUint32(42, currentOffset, true); // relative offset of local header

        centralDirHeaders.push(centralHeader, nameBytes);

        currentOffset += 30 + nameBytes.length + size;
    });

    let centralDirOffset = currentOffset;
    let centralDirSize = 0;
    centralDirHeaders.forEach(chunk => { centralDirSize += chunk.length; });

    // End of central directory record (22 bytes)
    let eocd = new Uint8Array(22);
    let eView = new DataView(eocd.buffer);
    eView.setUint32(0, 0x06054b50, true); // signature
    eView.setUint16(4, 0, true);          // disk number
    eView.setUint16(6, 0, true);          // disk with start of central directory
    eView.setUint16(8, files.length, true);  // entries on disk
    eView.setUint16(10, files.length, true); // total entries
    eView.setUint32(12, centralDirSize, true);
    eView.setUint32(16, centralDirOffset, true);
    eView.setUint16(20, 0, true);         // comment length

    let allChunks = [...localHeadersAndData, ...centralDirHeaders, eocd];
    return new Blob(allChunks, { type: 'application/zip' });
}

export function saveCurrentAsTxt() {
    flushPendingHeavyTask();
    s();
    const e = document.getElementById('e');
    let item = g(f);
    let name = item ? (item.name || '1枚目') : '原稿';
    let safeName = name.replace(/[\\/:*?"<>|]/g, '_');
    let text = getStoryPlainText(e ? e.innerHTML : (item ? item.content : ''));
    downloadTextFile(safeName + '.txt', text);
}

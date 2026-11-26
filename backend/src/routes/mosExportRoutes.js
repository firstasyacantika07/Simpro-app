const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');

const parseNum = (val) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
    if (!val) return 0;
    const n = parseFloat(String(val).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

const getMasuk = (row) => {
    const masuk = parseNum(row.jumlah_masuk);
    const jumlah = parseNum(row.jumlah);
    if (row.jumlah_masuk !== undefined && row.jumlah_masuk !== null && row.jumlah_masuk !== '') {
        return masuk > 0 || jumlah === 0 ? masuk : jumlah;
    }
    return jumlah;
};

const getTerpakai = (row) => parseNum(row.jumlah_terpakai);

const getDateStr = (row) => {
    const raw = row.tanggal_masuk || row.tanggal_update || row.created_at;
    if (!raw) return '';
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        return raw.toISOString().split('T')[0];
    }
    return String(raw).split('T')[0].slice(0, 10);
};

const formatDateId = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
    const dt = new Date(parts[0], parts[1] - 1, parts[2]);
    return dt.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const formatMonthLabel = (monthKey) => {
    if (!monthKey) return 'Semua Periode';
    if (monthKey === 'tanpa-bulan') return 'Tanpa Tanggal';
    const [y, m] = monthKey.split('-').map(Number);
    if (!y || !m) return monthKey;
    return new Date(y, m - 1, 1).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
    });
};

const formatExportTimestamp = () => {
    const now = new Date();
    const datePart = now.toISOString().split('T')[0];
    const timePart = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    return { datePart, fullText: `${formatDateId(datePart)} ${timePart} WIB` };
};

async function queryFilteredMos({ proyekId, month, materialKey }) {
    const conditions = [];
    const params = [];

    if (proyekId) {
        conditions.push('m.proyek_id = ?');
        params.push(Number(proyekId));
    }

    let projectInfo = null;
    if (proyekId) {
        const [projRows] = await db.query(
            'SELECT id, nama_proyek, lokasi, status FROM proyek WHERE id = ? LIMIT 1',
            [Number(proyekId)]
        );
        projectInfo = projRows[0] || null;
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db.query(
        `SELECT m.*, p.nama_proyek, p.lokasi AS lokasi_proyek
     FROM mos m
     LEFT JOIN proyek p ON p.id = m.proyek_id
     ${whereSql}
     ORDER BY COALESCE(m.tanggal_masuk, m.tanggal_update, m.created_at) DESC, m.id DESC`,
        params
    );

    const filtered = rows
        .filter((row) => {
            const dateStr = getDateStr(row);
            if (month) {
                const rowMonth = dateStr && dateStr.length >= 7 ? dateStr.slice(0, 7) : 'tanpa-bulan';
                if (rowMonth !== month) return false;
            }
            if (materialKey) {
                const nama = String(row.nama_material || '').trim().toLowerCase();
                const satuan = String(row.satuan || 'Unit').trim().toLowerCase();
                if (`${nama}__${satuan}` !== String(materialKey).trim().toLowerCase()) {
                    return false;
                }
            }
            return true;
        })
        .map((row, idx) => {
            const dateStr = getDateStr(row);
            const jumlahMasuk = Number(getMasuk(row).toFixed(2));
            const jumlahTerpakai = Number(getTerpakai(row).toFixed(2));
            const sisa = Number((jumlahMasuk - jumlahTerpakai).toFixed(2));
            return {
                no: idx + 1,
                id: row.id,
                proyek_id: row.proyek_id,
                nama_proyek: row.nama_proyek || projectInfo?.nama_proyek || `Site #${row.proyek_id || '-'}`,
                lokasi_proyek: row.lokasi_proyek || projectInfo?.lokasi || '-',
                kode_material: row.kode_material || '-',
                nama_material: row.nama_material || '-',
                tanggal_masuk: dateStr ? new Date(`${dateStr}T00:00:00`) : null,
                tanggal_masuk_label: formatDateId(dateStr),
                jumlah_masuk: jumlahMasuk,
                jumlah_terpakai: jumlahTerpakai,
                sisa,
                satuan: row.satuan || 'Unit',
            };
        });

    return {
        rows: filtered,
        projectInfo:
            projectInfo ||
            (filtered[0]
                ? { nama_proyek: filtered[0].nama_proyek, lokasi: filtered[0].lokasi_proyek }
                : { nama_proyek: 'Semua Proyek / Site', lokasi: '-' }),
    };
}

// GET /api/fitur/mos/export/excel
router.get('/mos/export/excel', authenticateToken, async (req, res) => {
    try {
        const { proyek_id: proyekId, month, material_key: materialKey } = req.query;
        const { rows, projectInfo } = await queryFilteredMos({ proyekId, month, materialKey });
        const { datePart, fullText } = formatExportTimestamp();

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'SIMPRO';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Data MOS', {
            views: [{ state: 'frozen', ySplit: 8 }],
        });

        sheet.mergeCells('A1:H1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = 'LAPORAN MATERIAL ON SITE (MOS) - SIMPRO';
        titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        sheet.getRow(1).height = 28;

        sheet.mergeCells('A2:D2');
        sheet.getCell('A2').value = `Proyek / Site: ${projectInfo?.nama_proyek || 'Semua Proyek'}`;
        sheet.mergeCells('E2:H2');
        sheet.getCell('E2').value = `Lokasi: ${projectInfo?.lokasi || '-'}`;

        sheet.mergeCells('A3:D3');
        sheet.getCell('A3').value = `Periode Bulan: ${formatMonthLabel(month)}`;
        sheet.mergeCells('E3:H3');
        sheet.getCell('E3').value = `Waktu Export: ${fullText}`;

        sheet.mergeCells('A4:H4');
        sheet.getCell('A4').value = `Filter Material: ${materialKey ? materialKey.split('__')[0] : 'Semua Material'} | Diunduh oleh: ${req.user?.nama || req.user?.email || '-'}`;

        [2, 3, 4].forEach((rIdx) => {
            const row = sheet.getRow(rIdx);
            row.height = 20;
            row.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
            row.alignment = { vertical: 'middle' };
        });

        const headerRowIndex = 6;
        const headers = [
            'No',
            'Kode Material',
            'Nama Material',
            'Tanggal Masuk',
            'Jumlah Masuk',
            'Jumlah Terpakai',
            'Sisa',
            'Satuan',
        ];
        const headerRow = sheet.getRow(headerRowIndex);
        headerRow.height = 24;

        headers.forEach((text, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = text;
            cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
            cell.alignment = {
                vertical: 'middle',
                horizontal: i >= 4 ? 'right' : i === 0 || i === 3 ? 'center' : 'left',
                wrapText: true,
            };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
                bottom: { style: 'thin', color: { argb: 'FF1E3A8A' } },
                left: { style: 'thin', color: { argb: 'FF1E3A8A' } },
                right: { style: 'thin', color: { argb: 'FF1E3A8A' } },
            };
        });

        const dataStartRow = headerRowIndex + 1;
        rows.forEach((item, idx) => {
            const r = sheet.getRow(dataStartRow + idx);
            r.height = 20;
            r.values = [
                item.no,
                item.kode_material,
                item.nama_material,
                item.tanggal_masuk || item.tanggal_masuk_label,
                item.jumlah_masuk,
                item.jumlah_terpakai,
                item.sisa,
                item.satuan,
            ];

            const isEven = idx % 2 === 1;
            for (let col = 1; col <= 8; col++) {
                const cell = r.getCell(col);
                cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
                if (isEven) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                };

                if (col === 1) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (col === 4) {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (item.tanggal_masuk instanceof Date) {
                        cell.numFmt = 'dd/mm/yyyy';
                    }
                } else if (col >= 5 && col <= 7) {
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.numFmt = '#,##0.00';
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            }
        });

        if (rows.length > 0) {
            const totalRowIndex = dataStartRow + rows.length;
            const totalRow = sheet.getRow(totalRowIndex);
            totalRow.height = 22;
            sheet.mergeCells(`A${totalRowIndex}:D${totalRowIndex}`);
            totalRow.getCell(1).value = 'TOTAL KESELURUHAN';
            totalRow.getCell(5).value = { formula: `SUM(E${dataStartRow}:E${totalRowIndex - 1})` };
            totalRow.getCell(6).value = { formula: `SUM(F${dataStartRow}:F${totalRowIndex - 1})` };
            totalRow.getCell(7).value = { formula: `SUM(G${dataStartRow}:G${totalRowIndex - 1})` };
            totalRow.getCell(8).value = '';

            for (let col = 1; col <= 8; col++) {
                const cell = totalRow.getCell(col);
                cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: col >= 5 && col <= 7 ? 'right' : col === 1 ? 'center' : 'left',
                };
                if (col >= 5 && col <= 7) cell.numFmt = '#,##0.00';
                cell.border = {
                    top: { style: 'medium', color: { argb: 'FF64748B' } },
                    bottom: { style: 'double', color: { argb: 'FF64748B' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                };
            }
        }

        const colWidths = [6, 16, 34, 16, 16, 18, 14, 12];
        colWidths.forEach((baseWidth, idx) => {
            const col = sheet.getColumn(idx + 1);
            let maxLen = baseWidth;
            col.eachCell({ includeEmpty: false }, (cell, rowNum) => {
                if (rowNum <= 4) return;
                const valStr = cell.value && typeof cell.value === 'object' && cell.value.result !== undefined
                    ? String(cell.value.result)
                    : String(cell.value || '');
                if (!valStr.startsWith('=')) {
                    maxLen = Math.max(maxLen, Math.min(valStr.length + 4, 48));
                }
            });
            col.width = maxLen;
        });

        const filename = `MOS_Simpro_${datePart}.xlsx`;
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const buffer = await workbook.xlsx.writeBuffer();
        return res.send(Buffer.from(buffer));
    } catch (error) {
        return res.status(500).json({
            message: 'Gagal mengekspor data MOS ke Excel',
            error: error.message,
        });
    }
});

// GET /api/fitur/mos/export/pdf
router.get('/mos/export/pdf', authenticateToken, async (req, res) => {
    try {
        const { proyek_id: proyekId, month, material_key: materialKey } = req.query;
        const { rows, projectInfo } = await queryFilteredMos({ proyekId, month, materialKey });
        const { datePart, fullText } = formatExportTimestamp();

        const filename = `MOS_Simpro_${datePart}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        const doc = new PDFDocument({
            size: 'A4',
            layout: 'landscape',
            margins: { top: 36, bottom: 42, left: 36, right: 36 },
            bufferPages: true,
        });

        doc.pipe(res);

        const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const columns = [
            { key: 'no', label: 'No', width: 34, align: 'center' },
            { key: 'tanggal_masuk_label', label: 'Tanggal Masuk', width: 92, align: 'left' },
            { key: 'kode_material', label: 'Kode', width: 82, align: 'left' },
            { key: 'nama_material', label: 'Nama Material', width: 252, align: 'left' },
            { key: 'jumlah_masuk', label: 'Jumlah Masuk', width: 92, align: 'right' },
            { key: 'jumlah_terpakai', label: 'Terpakai', width: 88, align: 'right' },
            { key: 'sisa', label: 'Sisa', width: 82, align: 'right' },
            { key: 'satuan', label: 'Satuan', width: usableWidth - (34 + 92 + 82 + 252 + 92 + 88 + 82), align: 'left' },
        ];

        const drawHeaderBanner = () => {
            const x = doc.page.margins.left;
            const y = doc.page.margins.top;

            doc.rect(x, y, usableWidth, 42).fill('#0f172a');
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14)
                .text('LAPORAN DATA MATERIAL ON SITE (MOS) — SIMPRO', x + 12, y + 8);
            doc.fillColor('#cbd5e1').font('Helvetica').fontSize(9)
                .text(`Dicetak pada: ${fullText}`, x + 12, y + 26);

            const metaY = y + 50;
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9.5)
                .text(`Proyek / Site: ${projectInfo?.nama_proyek || 'Semua Proyek'}`, x, metaY)
                .text(`Periode: ${formatMonthLabel(month)}`, x + 390, metaY);

            doc.fillColor('#334155').font('Helvetica').fontSize(9)
                .text(`Lokasi: ${projectInfo?.lokasi || '-'}`, x, metaY + 14)
                .text(
                    `Filter Material: ${materialKey ? materialKey.split('__')[0] : 'Semua Material'}`,
                    x + 390,
                    metaY + 14
                );

            return metaY + 34;
        };

        const drawTableHeader = (startY) => {
            const x = doc.page.margins.left;
            const rowHeight = 24;

            doc.rect(x, startY, usableWidth, rowHeight).fill('#1d4ed8');
            let curX = x;
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5);

            columns.forEach((col) => {
                doc.text(col.label, curX + 4, startY + 7, {
                    width: col.width - 8,
                    align: col.align,
                    lineBreak: false,
                });
                curX += col.width;
            });

            return startY + rowHeight;
        };

        let currentY = drawHeaderBanner();
        currentY = drawTableHeader(currentY);

        if (rows.length === 0) {
            doc.fillColor('#64748b').font('Helvetica').fontSize(10)
                .text('Tidak ada data Material On Site sesuai filter yang dipilih.', doc.page.margins.left, currentY + 18, {
                    width: usableWidth,
                    align: 'center',
                });
        } else {
            let totalMasuk = 0;
            let totalTerpakai = 0;
            let totalSisa = 0;

            rows.forEach((item, idx) => {
                totalMasuk += item.jumlah_masuk;
                totalTerpakai += item.jumlah_terpakai;
                totalSisa += item.sisa;

                doc.font('Helvetica').fontSize(8.5);
                const namaHeight = doc.heightOfString(item.nama_material, {
                    width: columns[3].width - 8,
                });
                const rowHeight = Math.max(20, namaHeight + 8);
                const bottomLimit = doc.page.height - doc.page.margins.bottom - 16;

                if (currentY + rowHeight > bottomLimit) {
                    doc.addPage();
                    currentY = drawHeaderBanner();
                    currentY = drawTableHeader(currentY);
                }

                const x = doc.page.margins.left;
                if (idx % 2 === 1) {
                    doc.rect(x, currentY, usableWidth, rowHeight).fill('#f8fafc');
                }
                doc.strokeColor('#e2e8f0').lineWidth(0.5)
                    .moveTo(x, currentY + rowHeight)
                    .lineTo(x + usableWidth, currentY + rowHeight)
                    .stroke();

                let curX = x;
                doc.fillColor('#0f172a').font('Helvetica').fontSize(8.5);

                columns.forEach((col) => {
                    let valText = item[col.key] ?? '-';
                    if (['jumlah_masuk', 'jumlah_terpakai', 'sisa'].includes(col.key)) {
                        valText = Number(valText).toLocaleString('id-ID', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        });
                    } else {
                        valText = String(valText);
                    }

                    doc.text(valText, curX + 4, currentY + 5, {
                        width: col.width - 8,
                        align: col.align,
                    });
                    curX += col.width;
                });

                currentY += rowHeight;
            });

            const bottomLimit = doc.page.height - doc.page.margins.bottom - 16;
            if (currentY + 24 > bottomLimit) {
                doc.addPage();
                currentY = drawHeaderBanner();
                currentY = drawTableHeader(currentY);
            }

            const x = doc.page.margins.left;
            doc.rect(x, currentY, usableWidth, 22).fill('#e2e8f0');
            doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5)
                .text('TOTAL KESELURUHAN', x + 6, currentY + 6, { width: 450, align: 'left' })
                .text(
                    totalMasuk.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    x + 4 + columns.slice(0, 4).reduce((s, c) => s + c.width, 0),
                    currentY + 6,
                    { width: columns[4].width - 8, align: 'right' }
                )
                .text(
                    totalTerpakai.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    x + 4 + columns.slice(0, 5).reduce((s, c) => s + c.width, 0),
                    currentY + 6,
                    { width: columns[5].width - 8, align: 'right' }
                )
                .text(
                    totalSisa.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    x + 4 + columns.slice(0, 6).reduce((s, c) => s + c.width, 0),
                    currentY + 6,
                    { width: columns[6].width - 8, align: 'right' }
                );
        }

        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            const footerY = doc.page.height - doc.page.margins.bottom + 10;
            doc.fillColor('#64748b').font('Helvetica').fontSize(8)
                .text(
                    `SIMPRO — Material On Site (MOS) | Halaman ${i + 1} dari ${pages.count}`,
                    doc.page.margins.left,
                    footerY,
                    { width: usableWidth, align: 'right' }
                );
        }

        doc.end();
    } catch (error) {
        if (!res.headersSent) {
            return res.status(500).json({
                message: 'Gagal mengekspor data MOS ke PDF',
                error: error.message,
            });
        }
    }
});

module.exports = router;
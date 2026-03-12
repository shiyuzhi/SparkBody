function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Logs") || ss.insertSheet("Logs");
  
  try {
    // 強化解析：相容 no-cors 模式下的各種資料抓取方式
    var content = e.postData ? e.postData.contents : null;
    if (!content) {
      return ContentService.createTextOutput(JSON.stringify({ "success": false, "error": "No data received" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(content);
    var rows = [];

    // 處理批量數據 (Batch)
    if (data.batch && Array.isArray(data.batch)) {
      data.batch.forEach(function(item) {
        rows.push([
          item.timestamp,
          item.sessionId,
          item.userId,
          item.mode,
          item.activity,
          item.shape,
          item.weight,
          item.flow,
          item.kt,
          item.shape_n,
          item.weight_n,
          item.flow_n,
          item.baselineReady,
          item.note
        ]);
      });
    } else {
      // 相容單筆
      rows.push([
        data.timestamp, data.sessionId, data.userId, data.mode, data.activity,
        data.shape, data.weight, data.flow, data.kt,
        data.shape_n, data.weight_n, data.flow_n,
        data.baselineReady, data.note
      ]);
    }

    // 寫入試算表
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return ContentService.createTextOutput(JSON.stringify({ "success": true, "count": rows.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ "success": false, "error": err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 雖然 no-cors 模式下預檢會減少，但保留此函數以增加相容性
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
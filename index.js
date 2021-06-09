const maxDays = 30;

async function genReportLog(container, key, url) {
  const response = await fetch('/' + key + '_report.log');
  const statusLines = await response.text();
  
  const normalized = normalizeData(statusLines);
  const statusStream = constructStatusStream(key, url, normalized);
  document.getElementById('reports').appendChild(statusStream);
}

function constructStatusStream(key, url, uptimeData) {
  let container = templatize('statusContainerTemplate', { title: key, url: url });
  let streamContainer = templatize('statusStreamContainerTemplate');
  for (var ii = maxDays - 1; ii >= 0; ii--) {
    let line = constructStatusLine(key, ii, uptimeData[ii]);
    streamContainer.appendChild(line);
  }

  container.appendChild(streamContainer);
  return container;
}

function constructStatusLine(key, relDay, quartiles) {
  let line = templatize('statusLineTemplate')
  let date = new Date();
  date.setDate(date.getDate() - relDay);

  if (quartiles) {
    for (const [quartile, val] of Object.entries(quartiles)) {
      if (quartile === 'date') { continue; }
      line.insertBefore(constructStatusSquare(key, date, quartile, val), line.firstChild);
    }
  } else {
    for (const quartile of ['q1', 'q2', 'q3', 'q4']) {
      line.appendChild(constructStatusSquare(key, date, quartile, null));
    }
  }

  return line;
}

function constructStatusSquare(key, date, quartile, uptimeVal) {
  let color = uptimeVal == null ? 'nodata' : 
    uptimeVal == 1 ? 'success' :
    uptimeVal < 0.3 ? 'failure' : 'partial';
  let square = templatize('statusSquareTemplate', {
    color: color,
    tooltip: getTooltip(key, date, quartile, color),
  });
  return square;      
}

let cloneId = 0;
function templatize(templateId, parameters) {
  let clone = document.getElementById(templateId).cloneNode(true);
  clone.id = 'template_clone_' + cloneId++;
  if (!parameters) {
    return clone;
  }

  applyTemplateSubstitutions(clone, parameters);      
  return clone;
}

function applyTemplateSubstitutions(node, parameters) {
  const attributes = node.getAttributeNames();
  for (var ii = 0; ii < attributes.length; ii++) {
    const attr = attributes[ii];
    const attrVal = node.getAttribute(attr);
    node.setAttribute(attr, templatizeString(attrVal, parameters))
  }

  if (node.childElementCount == 0) {
    node.innerText = templatizeString(node.innerText, parameters);
  } else {
    const children = Array.from(node.children);
    children.forEach((n) => {
      applyTemplateSubstitutions(n, parameters);
    })
  }
}

function templatizeString(text, parameters) {
  if (parameters) {
    for (const [key, val] of Object.entries(parameters)) {
      text = text.replaceAll('$' + key, val);
    }
  }
  return text;
}

function getTooltip(key, date, quartile, color) {
  let statusText = color == 'nodata' ? 'No Data Available' :
    color == 'success' ? 'All operational' :
    color == 'failure' ? 'Systems experiencing issues' :
    color == 'partial' ? 'Some systems are experiencing issues' : 'Unknown';
  
  return `${key} | ${date.toDateString()} : ${quartile} : ${statusText}`;
}

function create(tag, className) {
  let element = document.createElement(tag);
  element.className = className;
  return element;
}

function normalizeData(statusLines) {
  const rows = statusLines.split('\n');
  const dateNormalized = splitRowsByDate(rows);
  console.dir(dateNormalized);
  
  let relativeDateMap = {};
  const now = Date.now();
  for (const [key, val] of Object.entries(dateNormalized)) {
    const relDays = getRelativeDays(now, new Date(key).getTime());
    const avgQuartiles = getAverageQuartiles(val);
    
    relativeDateMap[relDays] = avgQuartiles;
  }

  console.dir(relativeDateMap);
  return relativeDateMap;
}

function getAverageQuartiles(quartiles) {
  let avgMap = {};
  for (const [key, val] of Object.entries(quartiles)) {
    if (!val || val.length == 0) {
      avgMap[key] = null;
    } else {
      avgMap[key] = val.reduce((a, v) => a + v) / val.length;
    }
  }

  return avgMap;
}

function getAverageValue(arr) {
  return arr.reduce((a, v) => a + v) / arr.length;
}

function getRelativeDays(date1, date2) { 
  return Math.floor(Math.abs((date1 - date2) / (24 * 3600 * 1000)));
}

function splitRowsByDate(rows) {
  let dateValues = {};
  for (var ii = 0; ii < rows.length; ii++) {
    const row = rows[ii];
    if (!row) {
      continue;
    }

    const [dateTimeStr, resultStr] = row.split(',', 2);
    const dateTime = new Date(dateTimeStr.replace(/-/g, '/'));
    const dateStr = dateTime.toDateString();

    let resultArray = dateValues[dateStr];
    if (!resultArray) {
      resultArray = { q1: [], q2: [], q3: [], q4: [] };
      dateValues[dateStr] = resultArray;
    }

    let result = 0;
    if (resultStr.trim() == 'success') {
      result = 1;
    }
    const qk = getQuarterKey(dateTime);
    resultArray[qk].push(result);
  }
  return dateValues;
}

function getQuarterKey(dateTime) {
  const hr = dateTime.getHours();
  return (
    hr < 6 ? 'q1' : hr < 12 ? 'q2' : hr < 18 ? 'q3' : 'q4'
  );
}

function showTooltip(event) {
  
}

async function genAllReports() {
  const response = await fetch('/urls-config.txt');
  const configText = await response.text();
  const configLines = configText.split('\n');
  for (let ii = 0; ii < configLines.length; ii++) {
    const configLine = configLines[ii];
    const [key, url] = configLine.split('=');
    if (!key || !url) {
      continue;
    }

    await genReportLog(reportContainer, key, url);
  }
}
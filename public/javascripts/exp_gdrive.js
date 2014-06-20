saveToGDrive = function(fileData, callback) {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    var reader = new FileReader();
    reader.readAsBinaryString(fileData);
    reader.onload = function(e) {
        var contentType = fileData.type || 'application/octet-stream';
        var metadata = {
            'title': fileData.fileName,
            'mimeType': contentType
        };

        var base64Data = btoa(reader.result);
        var multipartRequestBody =
            delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: ' + contentType + '\r\n' +
                'Content-Transfer-Encoding: base64\r\n' +
                '\r\n' +
                base64Data +
                close_delim;

        var request = gapi.client.request({
            'path': '/upload/drive/v2/files',
            'method': 'POST',
            'params': {'uploadType': 'multipart'},
            'headers': {
                'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
            },
            'body': multipartRequestBody});
        if (!callback) {
            callback = function(file) {
                console.log(file)
            };
        }
        request.execute(callback);
    }
}

dumpToSheet = function(eid, csvData,callback){
    callback = callback || function(){};
    var Auth = 'Bearer ' + localStorage['labnote.access_token'];

    var title = 'Labnotebook: Experiment on '+moment().format('YYYY-MM-DD');
    var contentType = 'text/csv';
// var contentType = 'application/vnd.google-apps.spreadsheet';

    var metadata = {
        'title': title,
        'mimeType': contentType
    };
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    var headers = {
        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"',
        Authorization: Auth
    };

    var multipartRequestBody =
        delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: ' + contentType + '\r\n' +
            //      'Content-Transfer-Encoding: base64\r\n' +
            '\r\n' +
            csvData +
            close_delim;

//    var docId = exp.gdrive_id;
    var docId = null;

    if(docId){
        //Update
        updateCSV(eid,docId,headers,multipartRequestBody,function(res){
            if(res.success){
                callback(res);
            }else{
                addNewCSV(eid,headers,multipartRequestBody,callback);
            }
        });
    }else{
        //New
        addNewCSV(eid,headers,multipartRequestBody,callback);
    }
}

var updateCSV = function(eid,docId,headers,multipartRequestBody,callback){

    var request = gapi.client.request({
        'path': '/upload/drive/v2/files/'+docId,
        'method': 'PUT',
        'params': {'uploadType': 'multipart', convert: true},
        'headers': headers,
        'body': multipartRequestBody});
    request.execute(function(res){
        if(res.id){
            console.log(res.id);
            var url = getSpreadsheetUrl(res.id);
            callback({url: url,success:true, id:res.id});
        }else{
            callback({success: false, error: 'Update failed.'});
        }
    });
};

//Using raw request. This is ussable from server as well. (gapi library only works on client)
var addNewCSV = function (eid,headers,multipartRequestBody,callback) {
//    console.log(multipartRequestBody,headers);

    $.ajax({url: 'https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&convert=true',
        type: 'POST',
        headers: headers,
        data: multipartRequestBody,
        processData: false
        }).success(function(res){
            console.log(res);
            callback();
//            var id = res.data.id;
//            if(id){
//                setDumpGoogleDriveId(eid,id);
//                var url = getSpreadsheetUrl(id);
//                callback({url: url,success:true, id: id});
//            }else{
//                callback({success: false, error: 'Insert failed.'});
//            }
        });
};
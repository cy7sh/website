---
title: "Create a File Hosting Site on Azure"
date: 2024-09-07T13:03:55-04:00
draft: true
showdate: true
---

The goal is to create a website that lets users upload files, optionally encrypt it with a password, and provide them with a download link to that file. Check out [my implementation](https://trashcan.app/) to get a feel.

## Setup Storage Account and authorize access from the application

We will store the files as blobs in a storage account. Go ahead and create a storage account and add a container where you'd like to store the uploaded files. My container is called `userfiles`.

![](/images/trashcan-1.png)

Now that our storage account is setup, we are going to write some code to talk to the storage account so that we can store files into it later. Create a Python file and import the following:
```
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
```
If you don't have these modules run `pip install azure-storage-blob azure-identity` in a terminal to install them. You can authorize your application to Azure Blob Storage by using the account access key, but that's not recommended because if you ever expose that key inadvertently, anyone can have full access to your storage account. `DefaultAzureCredential` supports all kinds of authentication methods and automatically decides which one to use at runtime so you don't have to make any code changes when switching environments. For example, your app can use your Azure CLI credentials to authenticate itself when running locally and use a managed identity when it's deployed to Azure. This is exactly how we will doing things. Since we will be running things locally first, make sure that you are logged into Azure CLI with the `az login` command.

The account you use to login to Azure CLI must have correct permissions to read and write blob data. Specifically, the `Microsoft.Storage/storageAccounts/blobServices/containers/blobs` DataActions. You may want to assign yourself the *Storage Blob Data Contributor* role which has all the necessary permissions.

![](/images/trashcan-5.png)
![](/images/trashcan-6.png)

It's very simple to connect to your storage account with `DefaultAzureCredential`:
```
CONTAINER_NAME = 'userfiles'

try:
    account_url = "https://trashcancy.blob.core.windows.net"
    default_credential = DefaultAzureCredential()

    blob_service_client = BlobServiceClient(account_url, credential=default_credential)

except Exception as ex:
    print('Exception:')
    print(ex)
```
Go ahead and run that. If it runs without any error, it's working.

## Create a website that lets user upload a file

Now, we will write code for the web app. If you don't have Flask installed, run `pip install Flask`. You probably don't want to allow users to upload every type of file. We will create a function to check if we allow the file the user is trying to upload.
```
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'docx'}
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
```
For the website itself:
```
from flask import Flask, flash, request, redirect, Response
from werkzeug.utils import secure_filename

app = Flask(__name__)
@app.route('/', methods=['GET', 'POST'])
def upload_file():
    # a POST request means the browser is sending a file
    if request.method == 'POST':
        if 'file' not in request.files:
            flash("No file part")
            return redirect(request.url)
        file = request.files['file']
        # the browser sends an empty filename if the user did not select a file
        if file.filename == '':
            flash('No selected file')
            return redirect(request.url)
        # check if the file is allowed
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=filename)
            blob_client.upload_blob(file)

    # this is the HTML page that's sent in response to a GET request includes a form that lets the user upload a file
    return '''
    <!doctype html>
    <title>Upload new File</title>
    <h1>Upload new File</h1>
    <form method=post enctype=multipart/form-data>
      <input type=file name=file>
      <input type=submit value=Upload>
    </form>
    '''
```
We use `secure_filename` to protect against malicious filenames which are often used by attackers to exploit web applications. You really just need these two lines of code to upload the file to Azure Blob Storage:
```
blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=filename)
blob_client.upload_blob(file)
```
This uploads the file to `CONTAINER_NAME` container as a blob with name `filename`.

Run the application locally in a development server with `flask run -app <filename.py>`. Flask will output the URL of your local server.

![](/images/trashcan-2.png)

You should be able to browse to your container on Azure Portal and see the file you just uploaded in there.

![](/images/trashcan-3.png)

## Let the user download a file

You can create a SAS link that lets the user download the file straight from Azure Blob Storage. But, we are not doing that. One of our features is encryption. Our app would need to fetch data from Azure and decrypt it before sending it to the browser. We will have Storage Key Access for our Storage Account disabled when we deploy to Azure anyway. With these lines of code you can get the requested file from Azure and send it to the browser:

```
@app.route('/file/<name>')
def download_file(name):
    def generate_file():
        blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=name)
        stream = blob_client.download_blob()
        for chunk in stream.chunks():
            yield chunk
    return Response(generate_file(), mimetype=mimetypes.guess_type(name)[0])
```

The user can visit `/file/<filename>` to download an uploaded file. `generate_file()` is a generator function that fetches the file data from Azure Blob Storage chunk by chunk. If it's a large file, you don't want to download all of it into the memory at once. Flask supports generator function as a response which means you can just pass this function to `Response()`. Now your app gets a chunk from Azure Blob Storage sends it to the browser, gets the next chunk and repeats until the whole file is transferred. Hopefully, you won't run out of memory transmitting large files now. Also, make sure the `mimetype` is correct so the browser knows what you're sending. Use `mimetypes.guess_type()` to guess the type based on the file extension. This function returns a `(type, encoding)` tuple where *type* is a string like `type/subtype`, suitable for the `Content-Type` header.

Try to download the file you just uploaded.

![](/images/trashcan-4.png)

Perfect! The browser knows that it's a image file because of the correctly labeled `Content-Type` and displays it. You can also set the `Content-Disposition` header to attachment to instruct the browser to download the file to disk instead of displaying it. To do this add a `headers` argument to the returned Response:

```
return Response(generate_file(), mimetype=mimetypes.guess_type(name)[0], headers={'Content-disposition': 'attachment'})
```

I'm not going to do that though. I will let the user decide what goes into their disk.
#!/usr/bin/python3

from flask import Flask, render_template, request
from werkzeug import secure_filename

app = Flask(__name__)

@app.route("/upload")
def upload():
	return render_template("upload.html")

@app.route("/uploader", methods = ["GET","POST"])
def uploade_file():
	if request.method == "POST":
		f = request.files["file"]
		f.save(secure_filename(f.filename))
		with open(f.filename,"a") as myfile:
			myfile.write("\nAdding more stuff")
		return "file uploaded successfully"

if __name__ == "__main__":
   app.run(port = 5006)
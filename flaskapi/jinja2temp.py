#!/usr/bin/env python3
from flask import Flask, render_template
app = Flask(__name__)

@app.route("/")
def index():
    return render_template("hellobasic.html")

@app.route("/<username>")
def userbuilder(username):
	return render_template("hellobasic2.html", name = username)
	
if __name__ == "__main__":
    app.run(port=5006)
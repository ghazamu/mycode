#!/usr/bin/env python3
from flask import Flask, redirect, url_for
app = Flask(__name__)

@app.route("/admin")
def hello_admin():
    return "Hello \n\r Admin"

@app.route("/guest/<guest>")
def hello_guest(guest):
    #return "Hello %s as Guest" % guest
    return "Hello {} Guest".format(guest)

@app.route("/user/<name>")
def hello_user(name):
    if name =="admin":
        return redirect(url_for("hello_admin"))
    else:
        return redirect(url_for("hello_guest",guest = name))

if __name__ == "__main__":
    app.run(port=5006)
    #app.run(port=5006, debug = True)
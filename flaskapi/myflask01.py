#!/usr/bin/python3
# An object of Flask class is our WSGI application
from flask import Flask

# Flask constructor takes the name of current
# module (__name__) as argument
app = Flask(__name__)

# route() function of the Flask class is a
# decorator, tells the application which URL
# should call the associated function

@app.route("/")
def hello_world():
   return "Hello World"


@app.route("/ali")
def mag():
    return "Yo, what's up?"

@app.route("/hello/<name>")
def hello_name(name):
    msg = "Hello {}".format(name).replace("_"," ")
    return (f"{msg} you have reached nothingness...")

if __name__ == "__main__":
   app.run(port=5006) # runs the application
   # app.run(port=5006, debug=True) # DEBUG MODE
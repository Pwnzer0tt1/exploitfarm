import setuptools

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setuptools.setup(
    name="xfarm",
    version="0.0.1",
    author="Pwnzer0tt1",
    author_email="pwnzer0tt1@poliba.it",
    py_modules=["xfarm"],
    install_requires=["exploitfarm"],
    include_package_data=True,
    description="Exploit Farm client",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/pwnzer0tt1/exploitfarm",
    packages=setuptools.find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: GNU Affero General Public License v3",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.10',
)

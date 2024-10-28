---
title: "Testing Peasycrypt"
date: 2022-10-02
draft: true
---

It was a bit challenging for me to write tests for Peasycrypt because it dealt with files on the filesytem. My first course of action was to peek at how rclone did it. I came across this function in its codebase:

{{<highlight go>}}
// createSimpleTestData creates simple test data in testFolder/subFolder
func createSimpleTestData(t *testing.T) string {
	createTestFolder("testdata", t)
	createTestFile("testdata/file1.txt", t)
	createTestFile("testdata/file2.txt", t)
	createTestFolder("testdata/folderA", t)
	createTestFile("testdata/folderA/fileA1.txt", t)
	createTestFile("testdata/folderA/fileA2.txt", t)
	createTestFolder("testdata/folderA/folderAA", t)
	createTestFile("testdata/folderA/folderAA/fileAA1.txt", t)
	createTestFile("testdata/folderA/folderAA/fileAA2.txt", t)
	createTestFolder("testdata/folderB", t)
	createTestFile("testdata/folderB/fileB1.txt", t)
	createTestFile("testdata/folderB/fileB2.txt", t)
	return testFolder + "/testdata"
}
{{</highlight>}}

From this I got the idea that I can build a test directory tree as part of the testing, then test alternations on that directory, and clean everything once we're done. Googling, I figured out that creating a directory named "testdata" was the idiomatic way to do this and I knew this is what I needed to do. The `go test` documentation also stated that the go tool will ignore a directory named "testdata" (idk how that's useful).

The rclone codebase also used a function called `TestMain` in their testing code which looked like it was setting some things before the test began. I looked at the testing documentation and figured out that this function is called at the beginning of a test and is intended for preliminary setup. My `TestMain` function looked like this:

{{<highlight go>}}
func TestMain(m *testing.M) {
	// Setup test paths
	var err error
	rootDir, err = filepath.Abs(".")
	checkErr(err)
	testDir, err = filepath.Abs("testdata")
	checkErr(err)
	plainDir, err = filepath.Abs("testdata/plain")
	checkErr(err)
	cryptDir, err = filepath.Abs("testdata/crypt")
	checkErr(err)

	// Setup cipher
	c, err = newCipher("", "")
	checkErr(err)
	os.Exit(m.Run())
}
{{</highlight>}}

This sets up the absolute locations for our test directories. This is necessary because we will be changing the working directory as part of the test. We will create a cipher with an empty password and the default salt. It's important that we always use this exact password because of all the encrypted data we'll hardcode later on.

Now onto testing file encryption.

{{<highlight go>}}
createTestDirs(t)

plainFile := filepath.Join(plainDir, "hello.txt")
plainData := []byte("hello this is peasycrypt speaking")
createFile(plainFile, plainData, t)

os.Chdir(cryptDir)
encryptFile(plainFile, false)
{{</highlight>}}

We'll first create the test directories as defined in our `TestMain` function. Then, we'll create the `hello.txt` file with some content in `plainDir`. Then we'll change workng directory to `cryptDir` and call `encryptFile`. It will encrypt the file and store it in our working directory which is `cryptDir`.

{{<highlight go>}}
cipherFile := filepath.Join(cryptDir, "JEKQ5W7EBBGACXZOCU6QCNFUL4======")
cipherdata, err := os.ReadFile(cipherFile)
if errors.Is(err, os.ErrNotExist) {
	t.Errorf("failed to create file with encrypted name")
} else if err != nil {
	t.Error(err)
}

decryptedName, err := c.decryptName(filepath.Base(cipherFile))
if err != nil {
	t.Errorf("failed name decryption: %v", err)
}
if decryptedName != filepath.Base(plainFile) {
	t.Errorf("decrypted name mismatch")
}

decryptedData, err := c.decryptData(cipherdata)
if err != nil {
	t.Errorf("failed data decryption: %v", err)
}
if bytes.Compare(plainData, decryptedData) != 0 {
	t.Errorf("decrypted data mismatch")
}
{{</highlight>}}

We'll then go ahead to check if the file was encrypted correctly. As filename encryption is deterministic, I've hardcoded what the encrypted name should be. We cannot hardcode what the encrypted data should be since the nonce is randomly generated every time. So, we'll decrypt the file's data and check if it matches what we started with. If this works, encryption and decryption both are working perfectly.

{{<highlight go>}}
// Since deleteSrc was set to false, the original file should still exist
exist, err := doesFileExist(plainFile)
if !exist {
	if err == nil {
		t.Errorf("file deleted when deleteSrc set to false")
	} else {
		t.Error(err)
	}
}

// Original file should be deleted when deleteSrc is set to true
encryptFile(plainFile, true)
exist, err = doesFileExist(plainFile)
if exist {
	t.Errorf("file not deleted when deleteSrc set to false")
} else if err != nil {
	t.Error(err)
}

os.Chdir(rootDir)
removeTestDirs(t)
{{</highlight>}}

Lastly, we'll check the "delete source" functionality, which if set to true, will delete the original file after the encrypted one is created. Since we set it to false, we'll check if the file still exists. We'll encrypt the file again with `deleteSrc` set to true and this time the original file should be deleted. We'll change our working directory back to `rootDir` and clean the testing directories we created.

Now let's test directory encryption.

{{<highlight go>}}
createTestDirs(t)

err := os.MkdirAll(filepath.Join(plainDir, "/writings/nicer"), os.ModePerm)
if err != nil {
	t.Error(err)
}

createFile(filepath.Join(plainDir, "writings/hello.txt"), []byte("hello"), t)
createFile(filepath.Join(plainDir, "writings/hi.txt"), []byte("hi"), t)
createFile(filepath.Join(plainDir, "writings/nicer/nicehello.txt"), []byte("nice hello"), t)
createFile(filepath.Join(plainDir, "writings/nicer/nicehi.txt"), []byte("nice hi"), t)
{{</highlight>}}

We again start out by setting up the test directories, but this time we also create the directories `writings` and `writings/nicer`. Then, we create some files inside them.

{{<highlight go>}}
expectedTreeWithoutRoot := []string{
	"DLLEA4TLUPRHUQQUQZUDTSWIW4======",
	"DLLEA4TLUPRHUQQUQZUDTSWIW4======/CGCJTJLM4JNSAPOXNGM3GKQKLM======",
	"DLLEA4TLUPRHUQQUQZUDTSWIW4======/GHNM7O5RFLH3JLTVAA7NYKIZWU======",
	"DLLEA4TLUPRHUQQUQZUDTSWIW4======/GHNM7O5RFLH3JLTVAA7NYKIZWU======/HLIZPUQ5XCYEIIWTRMJ5INV7GA======",
	"DLLEA4TLUPRHUQQUQZUDTSWIW4======/GHNM7O5RFLH3JLTVAA7NYKIZWU======/X53HPKF55O2L6X4S54PP2JUMJU======",
	"DLLEA4TLUPRHUQQUQZUDTSWIW4======/JEKQ5W7EBBGACXZOCU6QCNFUL4======",
}
expectedTreeWithRoot := make([]string, len(expectedTreeWithoutRoot) + 1)
expectedTreeWithRoot[0] = "JNKKS57W7VHCCRMRVTO6FW4SCE======"
for i, withoutRoot := range expectedTreeWithoutRoot {
	withRoot := filepath.Join("JNKKS57W7VHCCRMRVTO6FW4SCE======", withoutRoot)
	expectedTreeWithRoot[i+1] = withRoot
}
{{</highlight>}}

I came up with an EXCEPTIONALLY creative way to test the structure of our directory tree after encryption. `expectedTreeWithoutRoot` and `expectedTreeWithRoot` are the two slices that are later passed to `checkDirTree` function to test the resulting directory tree when we omit to encrypt the root directory and when we don't.

{{<highlight go>}}
func checkDirTree(t *testing.T, path string, expectedTree []string) {
	var rootGone bool
	var i int
	err := filepath.WalkDir(path, func(path string, d fs.DirEntry, err error) error {
		if !rootGone {
			rootGone = true
			return nil
		}
		if !strings.HasSuffix(path, expectedTree[i]) {
			t.Errorf("direcotry is not what it should be.\nexpected: %v\ngot:%v", expectedTree[i], path)
		}
		i++
		return nil
	})
	if err != nil {
		t.Error(err)
	}
}
{{</highlight>}}

`checkDirTree` does a walk on `path`, skips the root directory, and compares the name of each directory it encounters with the corresponding element on the `expectedTree` slice. The output of `filepath.WalkDir` is deterministic, which means we can hardcode the order of files and directories it outputs after a successful run of `encryptDirectory`. Since the contents of `plainDir` are always the same, we know that the test failed when the output of `filepath.WalkDir` doesnot match with what we hard coded.

{{<highlight go>}}
encryptDirectory(plainDir + "/", cryptDir, true)
checkDirTree(t, cryptDir, expectedTreeWithoutRoot)

// Since we set deleteSrc to true, plainDir should now be empty
empty, err := isEmpty(plainDir, t)
if err != nil {
	t.Error(err)
} else if !empty {
	t.Errorf("plainDir not empty when deleteSrc set to true")
}
{{</highlight>}}

The rest is self-explanatory. We test if `deleteSrc` is behaving as it should.

{{<highlight go>}}
removeTestDirs(t)
createTestDirs(t)
encryptDirectory(plainDir, cryptDir, true)
checkDirTree(t, cryptDir, expectedTreeWithRoot)

// Since we set deleteSrc to true and did not omit the root directory, plainDir should not exist
exists, err := doesFileExist(plainDir)
if err != nil {
	t.Error(err)
} else if exists {
	t.Errorf("plainDir not deleted when deleteSrc set to true and root dir encryption not omitted")
}

removeTestDirs(t)
{{</highlight>}}

We run the test again without omitting the root directory. This time the directory at `srcPath` should be deleted when `deleteSrc` is set to true because it is encrypted as well.

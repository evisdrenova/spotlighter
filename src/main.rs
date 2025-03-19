// test.rs

// A simple function that adds two numbers.
fn add(a: i32, b: i32) -> i32 {
    a + b
}

// A function that subtracts the second number from the first.
fn subtract(a: i32, b: i32) -> i32 {
    a - b
}

// A function that multiplies two numbers.
fn multiply(a: i32, b: i32) -> i32 {
    a * b
}

// A function that divides two numbers, returning None if division by zero.
fn divide(a: i32, b: i32) -> Option<i32> {
    if b == 0 { None } else { Some(a / b) }
}

// A function that uses the above functions to perform a more complex operation.
fn complex_operation(x: i32) -> i32 {
    let sum = add(x, 10);
    let diff = subtract(sum, 3);
    multiply(diff, 2)
}

// A helper function that prints a greeting.
fn greet(name: &str) {
    println!("Hello, {}!", name);
}

// A function with multiple steps to simulate a larger block of code.
fn process_numbers(numbers: &[i32]) -> i32 {
    let mut total = 0;
    for &num in numbers {
        total = add(total, num);
    }
    total
}

// A nested module with additional functions.
mod test_module {
    // A simple test function inside a module.
    pub fn test1() {
        println!("Inside test_module::test1");
    }

    // Another test function inside a module.
    pub fn test2() {
        println!("Inside test_module::test2");
    }

    // A private function within the module.
    fn helper() {
        println!("Inside test_module::helper");
    }

    // A public function that calls the private helper.
    pub fn run_tests() {
        helper();
        test1();
        test2();
    }
}

// The main function that calls all the functions above.
fn main() {
    let a = 10;
    let b = 5;

    println!("{} + {} = {}", a, b, add(a, b));
    println!("{} - {} = {}", a, b, subtract(a, b));
    println!("{} * {} = {}", a, b, multiply(a, b));

    match divide(a, b) {
        Some(result) => println!("{} / {} = {}", a, b, result),
        None => println!("Division by zero!"),
    }

    println!("complex_operation({}) = {}", a, complex_operation(a));

    greet("Rustacean");

    let numbers = [1, 2, 3, 4, 5];
    println!("The sum of {:?} is {}", numbers, process_numbers(&numbers));

    // Call functions from the nested module.
    test_module::run_tests();
}
